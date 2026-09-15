//! AI credentials stay in the backend. Public configs carry references, never keys.
use crate::{ai::AiConfig, state_persistence::EncryptedPayload, storage::Storage};
use aes_gcm::aead::rand_core::{OsRng, RngCore};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, io::Write, path::Path};

pub const REFERENCE_PREFIX: &str = "gauss-horizon-ai-secret:v1:";
const ENVELOPE: &str = "_encryptedAiSecrets";

#[derive(Default, Serialize, Deserialize)]
struct Secrets {
    scope: String,
    api_key: String,
    headers: HashMap<String, String>,
}

fn reference(scope: &str, field: &str) -> String {
    format!("{REFERENCE_PREFIX}{}", URL_SAFE_NO_PAD.encode(serde_json::to_vec(&(scope, field)).unwrap()))
}
fn parse_reference(value: &str) -> Result<Option<(String, String)>, String> {
    let Some(encoded) =
        value.strip_prefix(REFERENCE_PREFIX).or_else(|| value.strip_prefix(crate::legacy::OLD_AI_REFERENCE))
    else {
        return Ok(None);
    };
    let bytes = URL_SAFE_NO_PAD.decode(encoded).map_err(|_| "Invalid AI credential reference")?;
    serde_json::from_slice(&bytes).map(Some).map_err(|_| "Invalid AI credential reference".into())
}

fn master_key(dir: &Path, create: bool) -> Result<String, String> {
    if let Ok(key) = crate::legacy::var("GAUSS_HORIZON_AI_MASTER_KEY") {
        if key.len() < 32 {
            return Err("GAUSS_HORIZON_AI_MASTER_KEY must contain at least 32 characters".into());
        }
        return Ok(key);
    }
    let path = dir.join("ai-master.key");
    if !path.exists() && create {
        let mut bytes = [0u8; 32];
        OsRng.fill_bytes(&mut bytes);
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        match options.open(&path) {
            Ok(mut file) => {
                crate::protected_file::restrict(&path)?;
                file.write_all(URL_SAFE_NO_PAD.encode(bytes).as_bytes()).map_err(|_| "Cannot write AI master key")?;
                file.sync_all().map_err(|_| "Cannot flush AI master key")?;
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(_) => return Err("Cannot create AI master key".into()),
        }
    }
    let metadata = std::fs::symlink_metadata(&path).map_err(|_| {
        "AI master key missing; restore it or set GAUSS_HORIZON_AI_MASTER_KEY. Existing secrets were not changed."
    })?;
    if !metadata.is_file() {
        return Err("AI master key must be a regular file".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if metadata.permissions().mode() & 0o077 != 0 {
            return Err("AI master key permissions must be 0600".into());
        }
    }
    #[cfg(windows)]
    crate::protected_file::restrict(&path)?;
    let key = std::fs::read_to_string(path).map_err(|_| "Cannot read AI master key")?;
    if key.len() < 32 {
        return Err("Invalid AI master key; existing secrets were not changed".into());
    }
    Ok(key)
}

fn secrets(dir: &Path, scope: &str, value: &serde_json::Value) -> Result<Secrets, String> {
    if let Some(envelope) = value.get(ENVELOPE) {
        let encrypted: EncryptedPayload =
            serde_json::from_value(envelope.clone()).map_err(|_| "Invalid AI secret envelope")?;
        let decoded = encrypted
            .decrypt(&master_key(dir, false)?)
            .map_err(|_| "Cannot decrypt AI credentials; restore the original master key")?;
        let secret: Secrets = serde_json::from_slice(&decoded).map_err(|_| "Invalid AI secret data")?;
        if secret.scope != scope {
            return Err("AI credential scope mismatch".into());
        }
        Ok(secret)
    } else {
        Ok(Secrets {
            scope: scope.into(),
            api_key: value["apiKey"].as_str().unwrap_or_default().into(),
            headers: serde_json::from_value(value["customHeaders"].clone()).unwrap_or_default(),
        })
    }
}

pub(crate) fn encode(dir: &Path, scope: &str, config: &AiConfig, old_json: Option<&str>) -> Result<String, String> {
    let old_value = old_json
        .map(serde_json::from_str)
        .transpose()
        .map_err(|_| "Invalid saved AI configuration")?
        .unwrap_or(serde_json::Value::Null);
    let old = secrets(dir, scope, &old_value)?;
    let resolve = |value: &str, field: &str| -> Result<String, String> {
        if let Some((owner, name)) = parse_reference(value)? {
            if owner != scope || name != field {
                return Err("AI credential reference does not belong to this configuration".into());
            }
            return Ok(if field == "apiKey" {
                old.api_key.clone()
            } else {
                old.headers.get(field).cloned().unwrap_or_default()
            });
        }
        Ok(value.into())
    };
    let secret = Secrets {
        scope: scope.into(),
        api_key: resolve(&config.api_key, "apiKey")?,
        headers: config
            .custom_headers
            .iter()
            .map(|(name, value)| Ok((name.clone(), resolve(value, name)?)))
            .collect::<Result<_, String>>()?,
    };
    let mut value = serde_json::to_value(config).map_err(|e| e.to_string())?;
    value["apiKey"] = serde_json::Value::String(String::new());
    value["customHeaders"] = serde_json::json!({});
    // Credential presence is public; values are not.
    value["_aiKeyConfigured"] = serde_json::json!(!secret.api_key.is_empty());
    value["_aiHeaderNames"] = serde_json::json!(secret.headers.keys().collect::<Vec<_>>());
    if !secret.api_key.is_empty() || !secret.headers.is_empty() {
        value[ENVELOPE] = serde_json::to_value(EncryptedPayload::encrypt(
            &serde_json::to_vec(&secret).map_err(|e| e.to_string())?,
            &master_key(dir, old_value.get(ENVELOPE).is_none())?,
        )?)
        .map_err(|e| e.to_string())?;
    }
    serde_json::to_string(&value).map_err(|e| e.to_string())
}

pub(crate) fn public_config(scope: &str, json: &str) -> Result<AiConfig, String> {
    let value: serde_json::Value = serde_json::from_str(json).map_err(|_| "Invalid AI configuration")?;
    let mut config: AiConfig = serde_json::from_value(value.clone()).map_err(|_| "Invalid AI configuration")?;
    if value.get(ENVELOPE).is_some() {
        config.api_key.clear();
        config.custom_headers.clear();
        if value["_aiKeyConfigured"].as_bool() == Some(true) {
            config.api_key = reference(scope, "apiKey");
        }
        for name in value["_aiHeaderNames"].as_array().into_iter().flatten().filter_map(|v| v.as_str()) {
            config.custom_headers.insert(name.into(), reference(scope, name));
        }
    } else if !config.api_key.is_empty() || !config.custom_headers.is_empty() {
        return Err("AI credential migration required".into());
    }
    Ok(config)
}

fn load_json(conn: &Connection, scope: &str) -> Result<Option<String>, String> {
    let (sql, id) = if let Some(id) = scope.strip_prefix("item:") {
        ("SELECT config_json FROM ai_configs WHERE id=?1", id)
    } else if let Some(id) = scope.strip_prefix("provider:") {
        ("SELECT config_json FROM ai_provider_configs WHERE provider=?1", id)
    } else if scope == "legacy" {
        ("SELECT config_json FROM ai_config WHERE id=?1", "1")
    } else {
        return Err("Invalid AI credential scope".into());
    };
    conn.query_row(sql, [id], |r| r.get(0)).optional().map_err(|e| e.to_string())
}

impl Storage {
    /// Only transfers references during explicit legacy migration/duplication.
    pub(crate) async fn rebind_ai_config(&self, scope: &str, config: &AiConfig) -> Result<AiConfig, String> {
        for value in std::iter::once(&config.api_key).chain(config.custom_headers.values()) {
            if parse_reference(value)?.is_some_and(|(owner, _)| owner != scope) {
                return self.resolve_ai_config(config).await;
            }
        }
        Ok(config.clone())
    }
    pub async fn resolve_ai_config(&self, config: &AiConfig) -> Result<AiConfig, String> {
        let mut config = config.clone();
        let dir = self.data_dir().to_path_buf();
        self.with_conn(move |conn| {
            let mut owner: Option<String> = None;
            for value in std::iter::once(&config.api_key).chain(config.custom_headers.values()) {
                if let Some((scope, _)) = parse_reference(value)? {
                    if owner.as_ref().is_some_and(|o| o != &scope) {
                        return Err("Mixed AI credential scopes".into());
                    }
                    owner = Some(scope);
                }
            }
            if let Some(scope) = owner {
                let json = load_json(conn, &scope)?.ok_or("AI provider configuration no longer exists")?;
                let stored: serde_json::Value = serde_json::from_str(&json).map_err(|_| "Invalid AI configuration")?;
                if stored["endpoint"].as_str() != Some(config.endpoint.as_str())
                    || stored["provider"] != serde_json::to_value(&config.provider).unwrap()
                {
                    return Err(
                        "Provider endpoint changed; save the configuration before using its stored credentials".into(),
                    );
                }
                let secret = secrets(&dir, &scope, &stored)?;
                if let Some((_, field)) = parse_reference(&config.api_key)? {
                    if field != "apiKey" {
                        return Err("Invalid API key reference".into());
                    }
                    config.api_key = secret.api_key;
                }
                for (name, value) in &mut config.custom_headers {
                    if let Some((_, field)) = parse_reference(value)? {
                        if &field != name {
                            return Err("Invalid header reference".into());
                        }
                        *value = secret.headers.get(name).cloned().ok_or("Saved AI header no longer exists")?;
                    }
                }
            }
            Ok(config)
        })
        .await
    }

    pub(crate) async fn migrate_ai_secrets(&self) -> Result<(), String> {
        let dir = self.data_dir().to_path_buf();
        self.with_conn(move |conn| {
            conn.execute_batch("PRAGMA secure_delete=ON").map_err(|e| e.to_string())?;
            let tx = conn.transaction().map_err(|e| e.to_string())?;
            let mut records = Vec::new();
            for (table, column, prefix) in [
                ("ai_config", "id", ""),
                ("ai_provider_configs", "provider", "provider:"),
                ("ai_configs", "id", "item:"),
            ] {
                let mut stmt = tx.prepare(&format!("SELECT CAST({column} AS TEXT),config_json FROM {table}")).map_err(|e|e.to_string())?;
                let rows = stmt.query_map([], |r| Ok((r.get::<_,String>(0)?, r.get::<_,String>(1)?))).map_err(|e|e.to_string())?;
                for row in rows {
                    let (id, json) = row.map_err(|e|e.to_string())?;
                    let scope = if prefix.is_empty() { "legacy".into() } else { format!("{prefix}{id}") };
                    let value: serde_json::Value = serde_json::from_str(&json).map_err(|_|"Invalid saved AI configuration")?;
                    // Validate ALL existing ciphertext before creating any key for legacy rows.
                    secrets(&dir, &scope, &value)?;
                    records.push((table, column, id, scope, value));
                }
            }
            for (table, column, id, scope, value) in records {
                if value.get(ENVELOPE).is_none() {
                    let config: AiConfig = serde_json::from_value(value).map_err(|_|"Invalid saved AI configuration")?;
                    let encoded = encode(&dir, &scope, &config, None)?;
                    tx.execute(&format!("UPDATE {table} SET config_json=?1 WHERE {column}=?2"), rusqlite::params![encoded,id]).map_err(|e|e.to_string())?;
                }
            }
            tx.commit().map_err(|e|e.to_string())?;
            Ok(())
        }).await.map_err(|e|format!("AI credential migration failed; no configuration rows changed: {e}. Check the original ai-master.key or GAUSS_HORIZON_AI_MASTER_KEY."))
    }
}

/// Validate an existing encrypted profile without changing its data or key.
pub(crate) fn validate_saved_secret(dir: &Path, value: &serde_json::Value) -> Result<(), String> {
    if let Some(envelope) = value.get(ENVELOPE) {
        let payload: EncryptedPayload =
            serde_json::from_value(envelope.clone()).map_err(|_| "Invalid encrypted AI credentials")?;
        payload.decrypt(&master_key(dir, false)?).map_err(|_| "Cannot decrypt AI credentials with the original key")?;
    }
    Ok(())
}
