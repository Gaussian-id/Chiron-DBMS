use gauss_horizon_core::{
    ai::{AiConfig, AiConfigItem},
    ai_secrets::REFERENCE_PREFIX,
    storage::Storage,
};
use serde_json::json;

fn config() -> AiConfigItem {
    serde_json::from_value(json!({"id":"stable-id","name":"Synthetic","provider":"openai-compatible","model":"manual-model","endpoint":"http://127.0.0.1:9999/v1","apiKey":"synthetic-key-only","customHeaders":{"X-Test":"synthetic-header-only"}})).unwrap()
}
fn disk_json(path: &std::path::Path) -> String {
    rusqlite::Connection::open(path)
        .unwrap()
        .query_row("SELECT config_json FROM ai_configs WHERE id='stable-id'", [], |r| r.get(0))
        .unwrap()
}

#[tokio::test]
async fn secrets_are_encrypted_redacted_and_keep_replace_delete_are_explicit() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("gauss-horizon.db");
    let storage = Storage::open(&path).await.unwrap();
    storage.save_ai_config_item(&config()).await.unwrap();
    let raw = disk_json(&path);
    assert!(!raw.contains("synthetic-key-only"));
    assert!(!raw.contains("synthetic-header-only"));
    let mut public = storage.load_ai_configs().await.unwrap().remove(0);
    assert!(public.config.api_key.starts_with(REFERENCE_PREFIX));
    assert!(public.config.custom_headers["X-Test"].starts_with(REFERENCE_PREFIX));
    let json = serde_json::to_string(&public).unwrap();
    assert!(!json.contains("synthetic-key-only"));
    assert!(!json.contains("synthetic-header-only"));
    public.config.model = "another-manual-model".into();
    storage.save_ai_config_item(&public).await.unwrap();
    assert_eq!(storage.resolve_ai_config(&public.config).await.unwrap().api_key, "synthetic-key-only");
    let mut wrong_endpoint = public.config.clone();
    wrong_endpoint.endpoint = "https://example.invalid".into();
    assert!(storage.resolve_ai_config(&wrong_endpoint).await.is_err());
    public.config.api_key = "replacement-test-key".into();
    public.config.custom_headers.clear();
    storage.save_ai_config_item(&public).await.unwrap();
    let mut saved = storage.load_ai_configs().await.unwrap().remove(0);
    let runtime = storage.resolve_ai_config(&saved.config).await.unwrap();
    assert_eq!(runtime.api_key, "replacement-test-key");
    assert!(runtime.custom_headers.is_empty());
    saved.config.api_key.clear();
    storage.save_ai_config_item(&saved).await.unwrap();
    assert!(storage.load_ai_configs().await.unwrap()[0].config.api_key.is_empty());
    assert!(!disk_json(&path).contains("replacement-test-key"));
}

#[tokio::test]
async fn plaintext_migration_preserves_ids_models_and_missing_keys_never_reinitialize() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("gauss-horizon.db");
    let storage = Storage::open(&path).await.unwrap();
    let item = config();
    let raw = serde_json::to_string(&item.config).unwrap();
    let conn = rusqlite::Connection::open(&path).unwrap();
    conn.execute(
        "INSERT INTO ai_configs(id,name,model,models,config_json,is_default) VALUES (?1,?2,?3,'[]',?4,1)",
        rusqlite::params![item.id, item.name, item.config.model, raw],
    )
    .unwrap();
    drop(conn);
    drop(storage);
    let storage = Storage::open(&path).await.unwrap();
    let public = storage.load_ai_configs().await.unwrap().remove(0);
    assert_eq!(public.id, "stable-id");
    assert_eq!(public.config.model, "manual-model");
    assert!(public.is_default);
    assert_eq!(storage.resolve_ai_config(&public.config).await.unwrap().api_key, "synthetic-key-only");
    assert!(!disk_json(&path).contains("synthetic-key-only"));
    if gauss_horizon_core::legacy::var_os("GAUSS_HORIZON_AI_MASTER_KEY").is_none() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(dir.path().join("ai-master.key")).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        let before = disk_json(&path);
        // A legacy plaintext row must not cause a new key to be created before
        // discovering that a different row still needs the missing original key.
        let conn = rusqlite::Connection::open(&path).unwrap();
        conn.execute(
            "INSERT INTO ai_config(id,config_json) VALUES (1,?1)",
            [serde_json::to_string(&config().config).unwrap()],
        )
        .unwrap();
        drop(conn);
        std::fs::rename(dir.path().join("ai-master.key"), dir.path().join("retained-test-key")).unwrap();
        assert!(Storage::open(&path).await.is_err());
        assert!(!dir.path().join("ai-master.key").exists());
        assert_eq!(disk_json(&path), before);
        assert!(storage.resolve_ai_config(&public.config).await.is_err());
        assert!(storage.save_ai_config_item(&config()).await.is_err());
        assert!(!dir.path().join("ai-master.key").exists());
    }
}

#[tokio::test]
async fn legacy_reference_migration_rebinds_in_backend_without_changing_selected_model() {
    let dir = tempfile::tempdir().unwrap();
    let storage = Storage::open(&dir.path().join("gauss-horizon.db")).await.unwrap();
    let original: AiConfig = config().config;
    storage.save_ai_config(&original).await.unwrap();
    let public = storage.load_ai_config().await.unwrap().unwrap();
    assert!(public.api_key.starts_with(REFERENCE_PREFIX));
    let item = AiConfigItem { id: "migrated-id".into(), name: "Legacy".into(), is_default: true, config: public };
    storage.save_ai_configs(&[item]).await.unwrap();
    let migrated = storage.load_ai_configs().await.unwrap().remove(0);
    assert_eq!(migrated.id, "migrated-id");
    assert_eq!(migrated.config.model, "manual-model");
    assert_eq!(storage.resolve_ai_config(&migrated.config).await.unwrap().api_key, "synthetic-key-only");
}

#[test]
fn chiron_preview_is_bounded_and_vectors_are_removed_recursively() {
    assert!(gauss_horizon_core::ai_chiron::validate_vector_sources("SEARCH demo NEAR [1,0,0];", "Find similar items")
        .is_err());
    assert!(
        gauss_horizon_core::ai_chiron::validate_vector_sources("SEARCH demo NEAR [1, 0, 0];", "Use [1,0,0]").is_ok()
    );
    assert!(
        gauss_horizon_core::ai_chiron::validate_vector_sources("SEARCH demo NEAR @first;", "Use point first").is_ok()
    );
    assert!(gauss_horizon_core::ai_chiron::validate_vector_sources("SEARCH demo NEAR @unknown;", "Find similar items")
        .is_err());
    let rows: Vec<_> =
        (0..30).map(|i| json!({"id":i,"vector":[0.1,0.2],"payload":{"vectors":[1,2],"field":"hello"}})).collect();
    let preview = gauss_horizon_core::ai_chiron::sharing_preview(&json!({"rows":rows}));
    let parsed: serde_json::Value = serde_json::from_str(&preview).unwrap();
    assert_eq!(parsed.as_array().unwrap().len(), 20);
    assert!(!preview.contains("vector"));
    let huge = gauss_horizon_core::ai_chiron::sharing_preview(&json!({"rows":[{"text":"x".repeat(17000)}]}));
    assert_eq!(huge, "[]");
    assert!(gauss_horizon_core::ai_chiron::proposal(
        "```chironql\nGET c POINTS 'x';\n```\n```chironql\nDROP COLLECTION c;\n```"
    )
    .is_err());
    assert!(gauss_horizon_core::ai_chiron::proposal("Which point ID?").unwrap().is_none());
}

#[test]
fn native_query_commentary_does_not_change_the_proposal() {
    use gauss_horizon_core::ai_chiron::{proposal, proposal_commentary};
    let answer =
        "GENERATE_ONLY\nThis counts matching points.\n```chironql\nCOUNT demo;\n```\nThe result remains local.";
    assert_eq!(proposal(answer).unwrap().as_deref(), Some("COUNT demo;"));
    let commentary = proposal_commentary(answer).unwrap();
    assert!(commentary.contains("This counts matching points."));
    assert!(commentary.contains("The result remains local."));
    assert!(!commentary.contains("COUNT demo;"));
    assert!(!commentary.contains("GENERATE_ONLY"));
    assert!(proposal_commentary("GENERATE_ONLY\n```chironql\nCOUNT demo;\n```").is_none());
    assert!(proposal_commentary("Plain explanation without a query").is_none());
}

#[test]
fn native_attachment_limits_reject_invalid_or_oversized_input_without_truncation() {
    use base64::Engine;
    use gauss_horizon_core::{
        ai::AiInlineImage,
        ai_chiron::{attachment_context, TextAttachment},
    };
    let file = |content: String| TextAttachment { name: "data.txt".into(), content, truncated: false };
    assert!(attachment_context(&[file("😀".repeat(6000))], &[]).is_ok());
    assert!(attachment_context(&[file("😀".repeat(6001))], &[]).is_err());
    assert!(
        attachment_context(&[file("x".repeat(12000)), file("x".repeat(12000)), file("x".repeat(8001))], &[]).is_err()
    );
    assert!(attachment_context(&(0..9).map(|_| file("x".into())).collect::<Vec<_>>(), &[]).is_err());
    let image = AiInlineImage { media_type: "image/png".into(), data: "eA==".into() };
    assert!(attachment_context(&[], &vec![image.clone(); 5]).is_err());
    assert!(attachment_context(&[], &[AiInlineImage { media_type: "image/svg+xml".into(), ..image.clone() }]).is_err());
    assert!(attachment_context(&[], &[AiInlineImage { data: "".into(), ..image.clone() }]).is_err());
    let too_large = AiInlineImage {
        data: base64::engine::general_purpose::STANDARD.encode(vec![1; 5 * 1024 * 1024 + 1]),
        ..image.clone()
    };
    assert!(attachment_context(&[], &[too_large]).is_err());
    let large =
        AiInlineImage { data: base64::engine::general_purpose::STANDARD.encode(vec![1; 5 * 1024 * 1024]), ..image };
    assert!(attachment_context(&[], &[large.clone(), large.clone(), large]).is_err());
}
