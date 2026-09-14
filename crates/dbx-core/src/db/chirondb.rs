//! Native ChironDB HTTP adapter. All execution goes through server classification
//! and the DBM's write lock; the generic SQL/REST vector path rejects this driver.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::vector_driver::{CollectionInfo, VectorClient};
use crate::connection::{AppState, PoolKind};

#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Assistant {
        request: crate::ai_chiron::Request,
    },
    Parse {
        query: String,
    },
    Metadata {
        collection: String,
    },
    Browse {
        collection: String,
        offset: Option<String>,
        limit: u32,
    },
    Execute {
        query: String,
        collection: Option<String>,
        #[serde(default)]
        trace: bool,
        #[serde(default)]
        confirm: bool,
        // DBM confirmation is separate from the server's affected-count gate.
        #[serde(default)]
        allow_destructive: bool,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Reply {
    pub status: u16,
    pub body: Value,
}

fn failure(code: &str, message: &str) -> Reply {
    Reply { status: 400, body: json!({"code": code, "error": message}) }
}

async fn send(request: reqwest::RequestBuilder) -> Result<Reply, String> {
    // No retries: after a transport failure a write may already have committed.
    let response = request.send().await.map_err(|_| {
        "ChironDB request failed or timed out. The outcome may be unknown; do not automatically retry writes."
            .to_string()
    })?;
    let status = response.status().as_u16();
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "ChironDB response was interrupted; the outcome may be unknown".to_string())?;
    let body = match serde_json::from_slice::<Value>(&bytes) {
        Ok(body) => body,
        // Authentication middleware and reverse proxies may return plain text.
        // Keep the HTTP status without rendering arbitrary proxy HTML.
        Err(_) if !(200..300).contains(&status) => json!({"error": format!("ChironDB request failed (HTTP {status})")}),
        Err(_) => return Err("ChironDB returned an invalid JSON response".to_string()),
    };
    Ok(Reply { status, body })
}

#[derive(Deserialize)]
struct Collection {
    name: String,
    vector_dim: Option<u32>,
}

pub async fn collections(client: &VectorClient) -> Result<Vec<CollectionInfo>, String> {
    let reply = send(client.get("/v1/collections")).await?;
    if !(200..300).contains(&reply.status) {
        return Err(format!("ChironDB connection denied or unavailable (HTTP {})", reply.status));
    }
    let values: Vec<Collection> =
        serde_json::from_value(reply.body).map_err(|_| "Invalid ChironDB collection list".to_string())?;
    Ok(values
        .into_iter()
        .map(|c| CollectionInfo { id: c.name.clone(), name: c.name, dimension: c.vector_dim, ..Default::default() })
        .collect())
}

fn validate_classification(body: &Value) -> Result<(&str, &str), String> {
    if body.get("ok").and_then(Value::as_bool) != Some(true) {
        return Err("ChironDB did not validate this statement".to_string());
    }
    let kind = body.get("kind").and_then(Value::as_str).unwrap_or("");
    let statement = body
        .get("statement")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .ok_or("ChironDB omitted the statement classification")?;
    if !matches!(kind, "read" | "write" | "admin") {
        return Err("Unknown ChironDB statement classification; execution blocked".to_string());
    }
    Ok((kind, statement))
}

fn destructive(statement: &str) -> bool {
    statement.starts_with("DELETE")
        || statement.starts_with("DROP")
        || statement.starts_with("UNRELATE")
        || statement.starts_with("RESTORE")
        || statement.starts_with("TRUNCATE")
}

fn validate_result(body: &Value) -> Result<(), String> {
    #[derive(Deserialize)]
    struct ResultShape {
        kind: String,
        query_id: String,
        stats: Value,
        #[serde(default)]
        columns: Vec<String>,
        #[serde(default)]
        rows: Vec<serde_json::Map<String, Value>>,
    }
    let shape: ResultShape = serde_json::from_value(body.clone()).map_err(|_| "Invalid ChironQL result".to_string())?;
    if !matches!(shape.kind.as_str(), "rows" | "affected" | "empty")
        || shape.query_id.is_empty()
        || !shape.stats.is_object()
        || (shape.kind == "rows" && !shape.rows.is_empty() && shape.columns.is_empty())
    {
        return Err("Invalid ChironQL result metadata".to_string());
    }
    Ok(())
}

/// Shared by authenticated web routes and Tauri commands. Never accepts a URL or
/// credential from a query request; resolve the saved connection/session instead.
pub async fn run(state: &AppState, connection_id: &str, request: Request) -> Result<Reply, String> {
    if let Request::Assistant { request } = request {
        return Box::pin(crate::ai_chiron::run(state, connection_id, request)).await;
    }
    run_guarded(state, connection_id, request, None).await
}

/// Only the native assistant can supply this internal approval context.
pub(crate) async fn run_guarded(
    state: &AppState,
    connection_id: &str,
    request: Request,
    ai_approval: Option<bool>,
) -> Result<Reply, String> {
    let seconds = state
        .configs
        .read()
        .await
        .get(connection_id)
        .ok_or("ChironDB connection not found")?
        .effective_query_timeout_secs();
    if seconds == 0 {
        return run_inner(state, connection_id, request, ai_approval).await;
    }
    tokio::time::timeout(std::time::Duration::from_secs(seconds), run_inner(state, connection_id, request, ai_approval))
        .await
        .map_err(|_| {
            "ChironDB query timed out. A write may already have committed; inspect the database before retrying."
                .to_string()
        })?
}

async fn run_inner(
    state: &AppState,
    connection_id: &str,
    request: Request,
    ai_approval: Option<bool>,
) -> Result<Reply, String> {
    let key = state.get_or_create_metadata_pool_for_session(connection_id, None, None).await?;
    let handle = state.pool_handle(&key).await;
    let client = match handle.as_ref() {
        Some(PoolKind::VectorDb(client)) if client.is_chirondb() => client.clone(),
        _ => return Err("Not a ChironDB connection".to_string()),
    };
    match request {
        Request::Assistant { .. } => Err("Nested assistant requests are not supported".into()),
        Request::Parse { query } => {
            let reply = send(client.post("/v1/chironql/parse").json(&json!({"query":query}))).await?;
            if (200..300).contains(&reply.status) {
                validate_classification(&reply.body)?;
            }
            Ok(reply)
        }
        Request::Metadata { collection } => {
            let reply = send(client.get("/v1/collections")).await?;
            if !(200..300).contains(&reply.status) {
                return Ok(reply);
            }
            let entry = reply
                .body
                .as_array()
                .ok_or("Invalid ChironDB metadata")?
                .iter()
                .find(|v| v["name"].as_str() == Some(&collection));
            let fields: Option<serde_json::Map<String, Value>> =
                entry.and_then(|v| v["payload_schema"].as_object()).map(|fields| {
                    fields
                        .iter()
                        .filter(|(_, t)| {
                            t.as_str().is_some_and(|t| {
                                let t =
                                    t.strip_prefix("optional_").or_else(|| t.strip_prefix("nullable_")).unwrap_or(t);
                                matches!(
                                    t,
                                    "string"
                                        | "integer"
                                        | "number"
                                        | "float"
                                        | "bool"
                                        | "boolean"
                                        | "object"
                                        | "array"
                                        | "keyword"
                                )
                            })
                        })
                        .map(|(k, v)| (k.clone(), v.clone()))
                        .collect()
                });
            let named_vectors: Option<serde_json::Map<String, Value>> = entry
                .and_then(|v| v["named_vector_dims"].as_object())
                .map(|m| m.iter().filter(|(_, v)| v.is_u64()).map(|(k, v)| (k.clone(), v.clone())).collect());
            let mut graph = Value::Null;
            if entry.is_some() {
                let segment = percent_encoding::utf8_percent_encode(&collection, percent_encoding::NON_ALPHANUMERIC);
                if let Ok(response) = send(client.get(&format!("/v1/collections/{segment}/graph/types"))).await {
                    if (200..300).contains(&response.status) {
                        if let Some(types) = response.body["edge_types"].as_array() {
                            graph = json!({"edge_types":types.iter().filter_map(|v|v["name"].as_str().map(|name|json!({"name":name,"weight_property":v["weight_property"].as_str()}))).collect::<Vec<_>>()});
                        }
                    }
                }
            }
            Ok(Reply {
                status: 200,
                body: json!({"collection_names":reply.body.as_array().unwrap().iter().filter_map(|v|v["name"].as_str()).collect::<Vec<_>>(),"name":collection,"listed":entry.is_some(),"vector_dim":entry.and_then(|v|v["vector_dim"].as_u64()),"payload_schema":fields,"named_vector_dims":named_vectors,"graph":graph}),
            })
        }
        Request::Browse { collection, offset, limit } => {
            if collection.is_empty() || !(1..=1000).contains(&limit) {
                return Err("A collection and a page size between 1 and 1000 are required".to_string());
            }
            let segment = percent_encoding::utf8_percent_encode(&collection, percent_encoding::NON_ALPHANUMERIC);
            let reply = send(
                client
                    .post(&format!("/v1/collections/{segment}/scroll"))
                    .json(&json!({"offset": offset, "limit": limit})),
            )
            .await?;
            if (200..300).contains(&reply.status) {
                if !reply
                    .body
                    .get("points")
                    .and_then(Value::as_array)
                    .is_some_and(|points| points.iter().all(Value::is_object))
                    || !reply.body.get("next_offset").is_some_and(|v| v.is_null() || v.is_string())
                {
                    return Err("Invalid ChironDB scroll response".to_string());
                }
            }
            Ok(reply)
        }
        Request::Execute { query, collection, trace, confirm, allow_destructive } => {
            if query.trim().is_empty() {
                return Err("ChironQL query cannot be empty".to_string());
            }
            let parsed = send(client.post("/v1/chironql/parse").json(&json!({"query": query}))).await?;
            if !(200..300).contains(&parsed.status) {
                return Ok(parsed);
            }
            let (kind, statement) = validate_classification(&parsed.body)?;
            if ai_approval.is_some() {
                if statement == "USE"
                    || parsed.body["collection"].as_str().is_some_and(|c| Some(c) != collection.as_deref())
                {
                    return Err("Assistant collection context changed; execution blocked".into());
                }
                if kind != "read" {
                    if ai_approval != Some(true) {
                        return Err("Assistant write requires human approval".into());
                    }
                    let configs = state.configs.read().await;
                    let config = configs.get(connection_id).ok_or("Connection no longer exists")?;
                    if crate::production_safety::is_production_database(
                        config,
                        collection.as_deref().unwrap_or_default(),
                    ) {
                        return Err("AI writes to production are blocked".into());
                    }
                }
            }
            if kind != "read" {
                if crate::query::connection_readonly_name(state, connection_id).await.is_some() {
                    return Ok(failure(
                        "dbm.read_only",
                        "ChironQL write blocked by the connection's read-only protection.",
                    ));
                }
                if (destructive(statement) || kind == "admin") && !allow_destructive {
                    return Ok(failure(
                        "dbm.confirmation_required",
                        "Confirm this destructive or administrative statement before sending it to ChironDB.",
                    ));
                }
            }
            let reply = send(
                client
                    .post("/v1/chironql")
                    .json(&json!({"query": query, "collection": collection, "trace": trace, "confirm": confirm})),
            )
            .await?;
            if (200..300).contains(&reply.status) {
                validate_result(&reply.body)?;
            }
            Ok(reply)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classification_fails_closed() {
        for body in [
            json!({}),
            json!({"ok": true, "kind": "unknown", "statement": "SEARCH"}),
            json!({"ok": false, "kind": "read", "statement": "SEARCH"}),
        ] {
            assert!(validate_classification(&body).is_err());
        }
        assert_eq!(
            validate_classification(&json!({"ok":true,"kind":"read","statement":"SEARCH"})).unwrap(),
            ("read", "SEARCH")
        );
        assert!(destructive("DELETE"));
        assert!(destructive("DROP COLLECTION"));
        assert!(!destructive("SEARCH"));
    }

    #[test]
    fn native_results_preserve_nested_data_and_reject_invalid_shapes() {
        let body = json!({"kind":"rows","columns":["id","payload"],"rows":[{"id":"α","payload":{"items":[1,true]}}],"stats":{"took_ms":1.25},"query_id":"q1","next":"opaque/cursor"});
        assert!(validate_result(&body).is_ok());
        assert_eq!(body["rows"][0]["payload"]["items"], json!([1, true]));
        assert!(validate_result(&json!({"kind":"rows"})).is_err());
        assert!(validate_result(&json!({"kind":"rows","rows":[[1]],"stats":{},"query_id":"q"})).is_err());
    }
}
