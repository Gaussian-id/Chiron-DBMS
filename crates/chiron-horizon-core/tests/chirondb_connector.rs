use chiron_horizon_core::{
    connection::AppState,
    db::{
        chirondb::{self, Request},
        vector_driver::{self, VectorClient, VectorDbKind},
    },
    models::connection::ConnectionConfig,
    storage::Storage,
};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

struct Fixture {
    state: AppState,
    requests: Arc<Mutex<Vec<(String, Value)>>>,
    server: tokio::task::JoinHandle<()>,
    _dir: tempfile::TempDir,
}
impl Drop for Fixture {
    fn drop(&mut self) {
        self.server.abort();
    }
}

async fn fixture() -> Fixture {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let requests = Arc::new(Mutex::new(Vec::new()));
    let captured = requests.clone();
    let server = tokio::spawn(async move {
        loop {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut bytes = Vec::new();
            let (head, body) = loop {
                let mut buffer = [0; 4096];
                let count = stream.read(&mut buffer).await.unwrap();
                if count == 0 {
                    return;
                }
                bytes.extend_from_slice(&buffer[..count]);
                if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                    let head = String::from_utf8_lossy(&bytes[..end]).to_string();
                    let length = head
                        .lines()
                        .find_map(|line| {
                            line.to_lowercase()
                                .strip_prefix("content-length:")
                                .map(|v| v.trim().parse::<usize>().unwrap())
                        })
                        .unwrap_or(0);
                    if bytes.len() >= end + 4 + length {
                        let body =
                            serde_json::from_slice::<Value>(&bytes[end + 4..end + 4 + length]).unwrap_or(Value::Null);
                        break (head, body);
                    }
                }
            };
            let path = head.lines().next().unwrap().split_whitespace().nth(1).unwrap().to_string();
            captured.lock().unwrap().push((path.clone(), body.clone()));
            let (status, response) = if !head.to_lowercase().contains("authorization: bearer fixture-key") {
                (401, json!({"error":"Unauthorized"}))
            } else if path == "/v1/chat/completions" {
                let content = &body["messages"].as_array().unwrap().last().unwrap()["content"];
                let prompt = content.as_str().map(str::to_owned).unwrap_or_else(|| {
                    content
                        .as_array()
                        .unwrap()
                        .iter()
                        .filter_map(|part| part["text"].as_str())
                        .collect::<Vec<_>>()
                        .join("\n")
                });
                let query = if prompt.contains("request-create") {
                    "CREATE COLLECTION fresh DIM 3;"
                } else if prompt.contains("request-list") {
                    "SHOW COLLECTIONS;"
                } else if prompt.contains("request-delete") {
                    "DELETE"
                } else if prompt.contains("request-uncertain") {
                    "UNCERTAIN"
                } else if prompt.contains("request-write") {
                    "UPSERT"
                } else if prompt.contains("request-unknown") {
                    "UNKNOWN"
                } else if prompt.contains("request-bad") {
                    "BAD"
                } else {
                    "SEARCH"
                };
                let content = if prompt.contains("request-empty") {
                    "".into()
                } else if prompt.contains("request-clarification") {
                    "Which point ID should I use?".into()
                } else if prompt.contains("request-multiple") {
                    "```chironql\nSEARCH\n```\n```chironql\nDELETE\n```".into()
                } else {
                    format!("```chironql\n{query}\n```")
                };
                (200, json!({"choices":[{"message":{"role":"assistant","content":content},"finish_reason":"stop"}]}))
            } else if path == "/v1/collections" {
                (200, json!([{"name":"demo","vector_dim":3}, {"name":"unknown-dimension"}]))
            } else if path == "/v1/chironql/parse" {
                let query = body["query"].as_str().unwrap();
                if query == "BAD" {
                    (400, json!({"code":"chironql.parse_error","error":"Bad query","position":2}))
                } else {
                    let (kind, statement) = match query {
                        "CREATE COLLECTION fresh DIM 3;" => ("admin", "CREATE COLLECTION"),
                        "SHOW COLLECTIONS;" => ("read", "SHOW COLLECTIONS"),
                        "UPSERT" | "UNCERTAIN" => ("write", "UPSERT"),
                        "DELETE" => ("write", "DELETE"),
                        "UNKNOWN" => ("new-class", "UNKNOWN"),
                        _ => ("read", "SEARCH"),
                    };
                    (
                        200,
                        json!({"ok":true,"kind":kind,"statement":statement,"collection":if statement == "CREATE COLLECTION" {Some("fresh")} else {None}}),
                    )
                }
            } else if path == "/v1/chironql" {
                if body["query"] == "UNCERTAIN" {
                    drop(stream);
                    continue;
                }
                if body["query"] == "DELETE" && body["confirm"] != true {
                    (
                        409,
                        json!({"code":"chironql.confirmation_required","error":"Delete matches?","affected_estimate":2,"query_id":"q-delete"}),
                    )
                } else if body["query"] == "UPSERT" || body["query"] == "DELETE" {
                    (200, json!({"kind":"affected","stats":{"affected":2,"took_ms":1.1},"query_id":"q-write"}))
                } else {
                    (
                        200,
                        json!({"kind":"rows","columns":["id","payload"],"rows":[{"id":"α","payload":{"tags":[1,true]}}],"stats":{"took_ms":0.5},"query_id":"q-read","trace":{"stages":[]}}),
                    )
                }
            } else if path == "/v1/collections/restricted/scroll" {
                (403, json!({"code":"forbidden", "error":"Collection access denied", "hint":"Check key scope"}))
            } else if path == "/v1/collections/malformed/scroll" {
                (200, json!({"points":[null], "next_offset":null}))
            } else if path == "/v1/collections/demo/scroll" {
                (
                    200,
                    json!({"points":[{"id":"α","vector":[1,0,0],"payload":{"nested":[true]}}],"next_offset":if body["offset"].is_null() { json!("opaque/+α") } else { Value::Null }}),
                )
            } else {
                (404, json!({"error":"Not found"}))
            };
            let body = if status == 401 { "Unauthorized".to_string() } else { response.to_string() };
            let message = format!("HTTP/1.1 {status} Test\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}", body.len());
            stream.write_all(message.as_bytes()).await.unwrap();
        }
    });
    let directory = tempfile::tempdir().unwrap();
    let storage = Storage::open(&directory.path().join("test.db")).await.unwrap();
    let state = AppState::new(storage);
    let config: ConnectionConfig = serde_json::from_value(json!({"id":"chiron","name":"Chiron test","db_type":"chirondb","host":"127.0.0.1","port":port,"username":"","password":"fixture-key","save_password":true,"read_only":true})).unwrap();
    state.configs.write().await.insert("chiron".to_string(), config);
    let ai: chiron_horizon_core::ai::AiConfigItem = serde_json::from_value(json!({"id":"mock","name":"Synthetic provider","provider":"openai-compatible","apiKey":"fixture-key","endpoint":format!("http://127.0.0.1:{port}/v1"),"model":"fixture-model","apiStyle":"completions","authMethod":"bearer","maxRetries":0})).unwrap();
    state.storage.save_ai_config_item(&ai).await.unwrap();
    Fixture { state, requests, server, _dir: directory }
}

fn execute(query: &str, allow_destructive: bool, confirm: bool) -> Request {
    Request::Execute {
        query: query.to_string(),
        collection: Some("demo".into()),
        trace: true,
        confirm,
        allow_destructive,
    }
}

fn generate(prompt: &str, generate_only: bool) -> Request {
    Request::Assistant {
        request: chiron_horizon_core::ai_chiron::Request::Generate {
            config_id: "mock".into(),
            model: "fixture-model".into(),
            prompt: prompt.into(),
            collection: "demo".into(),
            generate_only,
            text_attachments: vec![],
            images: vec![],
            request_id: None,
            conversation_id: None,
        },
    }
}
fn approve(body: &Value) -> Request {
    Request::Assistant {
        request: chiron_horizon_core::ai_chiron::Request::Approve {
            run_id: body["run_id"].as_str().unwrap().into(),
            approval_token: body["approval_token"].as_str().unwrap().into(),
        },
    }
}
fn count_requests(f: &Fixture, path: &str) -> usize {
    f.requests.lock().unwrap().iter().filter(|(p, _)| p == path).count()
}

#[tokio::test]
async fn native_history_roundtrips_without_sharing_results_and_is_retained_until_deleted() {
    let f = fixture().await;
    let mut conversation: chiron_horizon_core::ai::AiConversation = serde_json::from_value(json!({
        "id":"chat","title":"Create collection","connectionName":"Chiron test","database":"demo","createdAt":"2026-09-13T00:00:00Z","updatedAt":"2026-09-13T00:00:00Z",
        "messages":[
            {"role":"user","content":"Create a collection fresh"},
            {"role":"assistant","content":"Which dimension?","chiron":{"connectionId":"chiron","value":{"message":"Which dimension?"}}},
            {"role":"assistant","content":"Executed","chiron":{"connectionId":"chiron","value":{"query":"COUNT demo;","result":{"status":200,"body":{"rows":[{"secret":"PRIVATE_RESULT"}],"trace":"PRIVATE_TRACE"}},"explanation":"PRIVATE_EXPLANATION"}}}
        ]
    })).unwrap();
    f.state.storage.save_ai_conversation(&conversation).await.unwrap();
    let loaded = f.state.storage.load_ai_conversations().await.unwrap().remove(0);
    assert_eq!(
        loaded.messages[2].chiron.as_ref().unwrap()["value"]["result"]["body"]["rows"][0]["secret"],
        "PRIVATE_RESULT"
    );
    let context = chiron_horizon_core::ai_chiron::conversation_context(&loaded, "chiron");
    assert!(context.contains("Which dimension?"));
    assert!(context.contains("COUNT demo"));
    assert!(!context.contains("PRIVATE_"));
    assert!(chiron_horizon_core::ai_chiron::conversation_context(&loaded, "other").is_empty());
    conversation.title = "Renamed chat".into();
    f.state.storage.save_ai_conversation(&conversation).await.unwrap();
    for index in 0..55 {
        let mut extra = conversation.clone();
        extra.id = format!("extra-{index}");
        f.state.storage.save_ai_conversation(&extra).await.unwrap();
    }
    let chats = f.state.storage.load_ai_conversations().await.unwrap();
    assert_eq!(chats.len(), 56);
    assert_eq!(chats.iter().find(|c| c.id == "chat").unwrap().title, "Renamed chat");
    f.state.storage.delete_ai_conversation("chat").await.unwrap();
    assert_eq!(f.state.storage.load_ai_conversations().await.unwrap().len(), 55);
}

#[tokio::test]
async fn assistant_repeated_prompts_creation_and_empty_answers_are_visible() {
    let f = fixture().await;
    for round in 1..=5 {
        let request = serde_json::from_value(json!({"operation":"assistant","request":{"action":"generate","config_id":"mock","model":"fixture-model","prompt":"request-list","collection":"","generate_only":false,"request_id":format!("round-{round}")}})).unwrap();
        let answer = chirondb::run(&f.state, "chiron", request).await.unwrap();
        assert!(answer.body["result"]["body"]["query_id"].is_string(), "round {round}");
        let status = serde_json::from_value(
            json!({"operation":"assistant","request":{"action":"status","request_id":format!("round-{round}")}}),
        )
        .unwrap();
        assert_eq!(chirondb::run(&f.state, "chiron", status).await.unwrap().body["phase"], "Finished");
    }
    assert!(chirondb::run(&f.state, "chiron", generate("request-empty", false))
        .await
        .unwrap_err()
        .contains("no answer"));
    // The selected collection is demo, but CREATE deliberately targets fresh.
    let proposal = chirondb::run(&f.state, "chiron", generate("request-create", false)).await.unwrap();
    assert_eq!(proposal.body["collection"], "fresh");
    assert!(proposal.body["approval_token"].is_string());
    let before = count_requests(&f, "/v1/chironql");
    f.state.write_unlock_windows.unlock("chiron", 60).await.unwrap();
    let created = chirondb::run(&f.state, "chiron", approve(&proposal.body)).await.unwrap();
    assert_eq!(created.body["result"]["status"], 200);
    assert_eq!(count_requests(&f, "/v1/chironql"), before + 1);
    let requests = f.requests.lock().unwrap();
    let (_, execution) = requests.iter().rev().find(|(p, _)| p == "/v1/chironql").unwrap();
    assert_eq!(execution["collection"], "fresh");
}

#[tokio::test]
async fn assistant_production_and_uncertain_mutations_never_retry() {
    let f = fixture().await;
    {
        let mut configs = f.state.configs.write().await;
        let c = configs.get_mut("chiron").unwrap();
        c.read_only = false;
        c.is_production = true;
    }
    let proposal = chirondb::run(&f.state, "chiron", generate("request-write", false)).await.unwrap();
    let blocked = chirondb::run(&f.state, "chiron", approve(&proposal.body)).await.unwrap();
    assert!(blocked.body["message"].as_str().unwrap().contains("production"));
    assert_eq!(count_requests(&f, "/v1/chironql"), 0);
    f.state.configs.write().await.get_mut("chiron").unwrap().is_production = false;
    let proposal = chirondb::run(&f.state, "chiron", generate("request-uncertain", false)).await.unwrap();
    let grant = approve(&proposal.body);
    let uncertain = chirondb::run(&f.state, "chiron", grant.clone()).await.unwrap();
    assert!(uncertain.body["message"].as_str().unwrap().contains("uncertain"));
    assert_eq!(count_requests(&f, "/v1/chironql"), 1);
    assert!(chirondb::run(&f.state, "chiron", grant).await.is_err());
    assert_eq!(count_requests(&f, "/v1/chironql"), 1);
}

#[tokio::test]
async fn assistant_reads_keep_native_data_local_and_share_only_exact_preview() {
    let f = fixture().await;
    let response = chirondb::run(&f.state, "chiron", generate("Show points", false)).await.unwrap();
    assert_eq!(response.body["result"]["body"]["query_id"], "q-read");
    assert_eq!(count_requests(&f, "/v1/chironql"), 1);
    let outbound = f.requests.lock().unwrap().iter().find(|(p, _)| p == "/v1/chat/completions").unwrap().1.clone();
    assert_eq!(outbound["model"], "fixture-model");
    assert!(outbound["messages"][0]["content"].as_str().unwrap().contains("Narrative is displayed as plain text"));
    assert!(!outbound.to_string().contains("fixture-key"));
    assert!(!outbound.to_string().contains("tags"));
    assert!(!outbound.to_string().contains("q-read"));
    let run_id = response.body["run_id"].as_str().unwrap().to_string();
    let invalid = Request::Assistant {
        request: chiron_horizon_core::ai_chiron::Request::Explain {
            run_id: run_id.clone(),
            approved_preview: "[]".into(),
        },
    };
    assert!(chirondb::run(&f.state, "chiron", invalid).await.is_err());
    assert_eq!(count_requests(&f, "/v1/chat/completions"), 1);
    let preview = response.body["sharing_preview"].as_str().unwrap().to_string();
    let shared = Request::Assistant {
        request: chiron_horizon_core::ai_chiron::Request::Explain { run_id, approved_preview: preview.clone() },
    };
    chirondb::run(&f.state, "chiron", shared).await.unwrap();
    let outbound =
        f.requests.lock().unwrap().iter().filter(|(p, _)| p == "/v1/chat/completions").last().unwrap().1.clone();
    assert!(outbound.to_string().contains("tags"));
    assert!(outbound["messages"][0]["content"].as_str().unwrap().contains("Write plain text with line breaks"));
    assert!(!outbound.to_string().contains("q-read"));
    assert!(!outbound.to_string().contains("stages"));
}

#[tokio::test]
async fn assistant_write_approval_is_single_use_and_destructive_confirmation_is_additional() {
    let f = fixture().await;
    f.state.configs.write().await.get_mut("chiron").unwrap().read_only = false;
    let proposal = chirondb::run(&f.state, "chiron", generate("request-delete", false)).await.unwrap();
    assert_eq!(count_requests(&f, "/v1/chironql"), 0);
    let grant = approve(&proposal.body);
    let confirmation = chirondb::run(&f.state, "chiron", grant.clone()).await.unwrap();
    assert_eq!(confirmation.body["result"]["body"]["affected_estimate"], 2);
    assert!(chirondb::run(&f.state, "chiron", grant).await.is_err());
    assert_eq!(count_requests(&f, "/v1/chironql"), 1);
    let grant = approve(&confirmation.body);
    let result = chirondb::run(&f.state, "chiron", grant.clone()).await.unwrap();
    assert_eq!(result.body["result"]["body"]["query_id"], "q-write");
    assert!(chirondb::run(&f.state, "chiron", grant).await.is_err());
    assert_eq!(count_requests(&f, "/v1/chironql"), 2);
    let requests = f.requests.lock().unwrap();
    let mutations: Vec<_> = requests.iter().filter(|(p, _)| p == "/v1/chironql").collect();
    assert_eq!(mutations[0].1["query"], mutations[1].1["query"]);
    assert_eq!(mutations[0].1["collection"], mutations[1].1["collection"]);
    assert_eq!(mutations[0].1["confirm"], false);
    assert_eq!(mutations[1].1["confirm"], true);
}

#[tokio::test]
async fn assistant_cancellation_readonly_stale_target_and_generate_only_do_not_mutate() {
    let f = fixture().await;
    let read = chirondb::run(&f.state, "chiron", generate("generate only", false)).await.unwrap();
    let grant = approve(&read.body);
    let cancel = Request::Assistant {
        request: chiron_horizon_core::ai_chiron::Request::Cancel {
            run_id: read.body["run_id"].as_str().unwrap().into(),
        },
    };
    chirondb::run(&f.state, "chiron", cancel).await.unwrap();
    assert!(chirondb::run(&f.state, "chiron", grant).await.is_err());
    let write = chirondb::run(&f.state, "chiron", generate("request-write", false)).await.unwrap();
    let blocked = chirondb::run(&f.state, "chiron", approve(&write.body)).await.unwrap();
    assert_eq!(blocked.body["result"]["body"]["code"], "dbm.read_only");
    let stale = chirondb::run(&f.state, "chiron", generate("request-write", false)).await.unwrap();
    f.state.configs.write().await.get_mut("chiron").unwrap().name = "Changed target".into();
    let blocked = chirondb::run(&f.state, "chiron", approve(&stale.body)).await.unwrap();
    assert!(blocked.body["message"].as_str().unwrap().contains("changed"));
    assert_eq!(count_requests(&f, "/v1/chironql"), 0);
}

#[tokio::test]
async fn assistant_rejects_unknown_ambiguous_and_invalid_proposals_with_one_parse_correction() {
    let f = fixture().await;
    for prompt in ["request-unknown", "request-multiple"] {
        assert!(chirondb::run(&f.state, "chiron", generate(prompt, false)).await.is_err());
    }
    let before = count_requests(&f, "/v1/chat/completions");
    let invalid = chirondb::run(&f.state, "chiron", generate("request-bad", false)).await.unwrap();
    assert!(invalid.body["message"].as_str().unwrap().contains("one correction"));
    assert_eq!(count_requests(&f, "/v1/chat/completions") - before, 2);
    let clarification = chirondb::run(&f.state, "chiron", generate("request-clarification", false)).await.unwrap();
    assert!(clarification.body["query"].is_null());
    assert_eq!(count_requests(&f, "/v1/chironql"), 0);
}

#[tokio::test]
async fn chirondb_browse_preserves_cursor_nested_values_and_unknown_metadata() {
    let f = fixture().await;
    let list = chiron_horizon_core::schema::list_vector_collections_core(&f.state, "chiron", "default").await.unwrap();
    assert_eq!(list[0].dimension, Some(3));
    assert_eq!(list[1].dimension, None);
    let first =
        chirondb::run(&f.state, "chiron", Request::Browse { collection: "demo".into(), offset: None, limit: 100 })
            .await
            .unwrap();
    assert_eq!(first.body["points"][0]["payload"]["nested"], json!([true]));
    let cursor = first.body["next_offset"].as_str().unwrap().to_string();
    let second = chirondb::run(
        &f.state,
        "chiron",
        Request::Browse { collection: "demo".into(), offset: Some(cursor.clone()), limit: 100 },
    )
    .await
    .unwrap();
    assert!(second.body["next_offset"].is_null());
    assert_eq!(f.requests.lock().unwrap().last().unwrap().1["offset"], cursor);
    let denied = chirondb::run(
        &f.state,
        "chiron",
        Request::Browse { collection: "restricted".into(), offset: None, limit: 100 },
    )
    .await
    .unwrap();
    assert_eq!(denied.status, 403);
    assert_eq!(denied.body["hint"], "Check key scope");
    assert!(chirondb::run(
        &f.state,
        "chiron",
        Request::Browse { collection: "malformed".into(), offset: None, limit: 100 }
    )
    .await
    .is_err());
    assert!(chirondb::run(
        &f.state,
        "chiron",
        Request::Browse { collection: "demo".into(), offset: None, limit: 1001 }
    )
    .await
    .is_err());
}

#[tokio::test]
async fn chirondb_guards_read_only_unknown_and_destructive_execution() {
    let f = fixture().await;
    let read = chirondb::run(&f.state, "chiron", execute("SEARCH", false, false)).await.unwrap();
    assert_eq!(read.body["query_id"], "q-read");
    let denied = chirondb::run(&f.state, "chiron", execute("UPSERT", false, false)).await.unwrap();
    assert_eq!(denied.body["code"], "dbm.read_only");
    assert!(!f.requests.lock().unwrap().iter().any(|(path, b)| path == "/v1/chironql" && b["query"] == "UPSERT"));
    assert!(chirondb::run(&f.state, "chiron", execute("UNKNOWN", true, true)).await.is_err());
    let bad = chirondb::run(&f.state, "chiron", execute("BAD", false, false)).await.unwrap();
    assert_eq!(bad.body["position"], 2);
    f.state.write_unlock_windows.unlock("chiron", 60).await.unwrap();
    assert_eq!(
        chirondb::run(&f.state, "chiron", execute("UPSERT", false, false)).await.unwrap().body["stats"]["affected"],
        2
    );
    let prompt = chirondb::run(&f.state, "chiron", execute("DELETE", false, false)).await.unwrap();
    assert_eq!(prompt.body["code"], "dbm.confirmation_required");
    assert!(!f.requests.lock().unwrap().iter().any(|(path, b)| path == "/v1/chironql" && b["query"] == "DELETE"));
    let counted = chirondb::run(&f.state, "chiron", execute("DELETE", true, false)).await.unwrap();
    assert_eq!(counted.body["affected_estimate"], 2);
    let written = chirondb::run(&f.state, "chiron", execute("DELETE", true, true)).await.unwrap();
    assert_eq!(written.body["stats"]["affected"], 2);
    f.state.write_unlock_windows.lock("chiron").await;
    assert_eq!(
        chirondb::run(&f.state, "chiron", execute("DELETE", true, true)).await.unwrap().body["code"],
        "dbm.read_only"
    );
}

#[tokio::test]
async fn chirondb_rejects_wrong_key_and_generic_execution() {
    let f = fixture().await;
    let config = f.state.configs.read().await.get("chiron").unwrap().clone();
    let client = VectorClient::new(
        VectorDbKind::ChironDb,
        &format!("http://127.0.0.1:{}", config.port),
        None,
        Some("wrong-key"),
        false,
        std::time::Duration::from_secs(2),
    );
    assert!(vector_driver::test_connection(&client, std::time::Duration::from_secs(2))
        .await
        .unwrap_err()
        .contains("401"));
    let count = f.requests.lock().unwrap().len();
    assert!(vector_driver::execute_rest_query(&client, "POST /v1/chironql\n{\"query\":\"DELETE\"}").await.is_err());
    assert_eq!(f.requests.lock().unwrap().len(), count);
}

#[tokio::test]
async fn chirondb_rejects_shared_sql_and_mcp_batch_execution_without_dispatch() {
    let f = fixture().await;
    f.state.configs.write().await.get_mut("chiron").unwrap().read_only = false;
    f.state.write_unlock_windows.unlock("chiron", 60).await.unwrap();
    f.state.get_or_create_pool("chiron", Some("default")).await.unwrap();

    let error =
        chiron_horizon_core::query::execute_sql_statement(&f.state, "chiron", "default", "SELECT 1", None, None)
            .await
            .unwrap_err();
    assert!(error.contains("guarded ChironQL workspace"));

    // Upstream MCP now routes multi-statement queries through this shared path.
    // Even an unlocked connection and continue-on-error must not bypass ChironQL.
    let results = Box::pin(chiron_horizon_core::query::execute_multi_core_with_options_for_client(
        &f.state,
        "chiron",
        "default",
        "SELECT 1; DELETE FROM demo;",
        None,
        None,
        chiron_horizon_core::query::QueryExecutionOptions { continue_on_error: true, ..Default::default() },
    ))
    .await
    .unwrap();
    assert_eq!(results.len(), 2);
    assert!(results.iter().all(|result| result.execution_error
        && result.result.rows[0][0].as_str().unwrap().contains("guarded ChironQL workspace")));
    // Pool setup may repeat the authenticated collection-list probe, but no
    // query, parse, provider, or generic REST request may reach the server.
    let paths: Vec<_> = f.requests.lock().unwrap().iter().map(|(path, _)| path.clone()).collect();
    assert!(paths.iter().all(|path| path == "/v1/collections"), "Unexpected dispatch: {paths:?}");
}

const ATTACHMENT_PNG: &str =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=";
fn with_attachments(prompt: &str, draft: bool) -> Request {
    serde_json::from_value(json!({"operation":"assistant","request":{
        "action":"generate","config_id":"mock","model":"fixture-model","prompt":prompt,"collection":"demo","generate_only":draft,
        "text_attachments":[{"name":"fixture.csv","content":"category,value\nATTACHED_ONLY,7","truncated":true}],
        "images":[{"mediaType":"image/png","data":ATTACHMENT_PNG}]
    }})).unwrap()
}

#[tokio::test]
async fn native_attachments_reach_provider_and_are_not_replayed_or_executed_as_approval() {
    let f = fixture().await;
    let draft = chirondb::run(&f.state, "chiron", with_attachments("Describe attached data", true)).await.unwrap();
    assert!(draft.body["result"].is_null());
    {
        let requests = f.requests.lock().unwrap();
        let provider = &requests.iter().find(|(path, _)| path == "/v1/chat/completions").unwrap().1;
        let content = &provider["messages"].as_array().unwrap().last().unwrap()["content"];
        assert!(content[0]["text"].as_str().unwrap().contains("ATTACHED_ONLY"));
        assert!(content[0]["text"].as_str().unwrap().contains("untrusted data"));
        assert!(content[0]["text"].as_str().unwrap().contains("\"truncated\":true"));
        assert_eq!(content[1]["image_url"]["url"], format!("data:image/png;base64,{ATTACHMENT_PNG}"));
        assert!(!requests.iter().any(|(path, _)| path == "/v1/chironql"));
    }
    f.requests.lock().unwrap().clear();
    chirondb::run(&f.state, "chiron", generate("A separate request", true)).await.unwrap();
    {
        let requests = f.requests.lock().unwrap();
        let provider = &requests.iter().find(|(path, _)| path == "/v1/chat/completions").unwrap().1;
        assert!(!provider.to_string().contains("ATTACHED_ONLY"));
        assert!(!provider.to_string().contains("image_url"));
    }
    f.state.configs.write().await.get_mut("chiron").unwrap().read_only = false;
    let write = chirondb::run(&f.state, "chiron", with_attachments("request-write", false)).await.unwrap();
    assert!(write.body["approval_token"].is_string());
    assert!(write.body["result"].is_null());
    assert!(!f.requests.lock().unwrap().iter().any(|(path, _)| path == "/v1/chironql"));
}

#[tokio::test]
async fn native_parser_repair_keeps_explicit_attachments_but_never_executes_bad_query() {
    let f = fixture().await;
    let result = chirondb::run(&f.state, "chiron", with_attachments("request-bad", false)).await.unwrap();
    assert_eq!(result.body["result"]["status"], 400);
    let requests = f.requests.lock().unwrap();
    let providers: Vec<_> = requests.iter().filter(|(path, _)| path == "/v1/chat/completions").collect();
    assert_eq!(providers.len(), 2);
    for (_, body) in providers {
        assert!(body.to_string().contains(ATTACHMENT_PNG));
    }
    assert!(!requests.iter().any(|(path, _)| path == "/v1/chironql"));
}

#[tokio::test]
async fn malformed_native_attachment_fails_before_provider_or_database_request() {
    let f = fixture().await;
    let mut request = with_attachments("Read file", false);
    if let Request::Assistant { request: chiron_horizon_core::ai_chiron::Request::Generate { images, .. } } =
        &mut request
    {
        images[0].data = "not base64!".into();
    }
    assert!(chirondb::run(&f.state, "chiron", request).await.unwrap_err().contains("base64"));
    assert!(f.requests.lock().unwrap().is_empty());
}
