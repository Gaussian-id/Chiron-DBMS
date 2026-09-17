//! Explicit compatibility boundary for pre-Chiron Horizon profiles and environment names.
//! Legacy names here are intentionally not product branding.
use fs2::FileExt;
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use std::{
    ffi::{OsStr, OsString},
    path::{Path, PathBuf},
};

pub const OLD_APP_ID: &str = "com.dbx.app";
pub const APP_ID: &str = "id.chiron.horizon";
pub const OLD_AI_REFERENCE: &str = "dbx-ai-secret:v1:";
pub fn var_os(name: impl AsRef<OsStr>) -> Option<OsString> {
    let name = name.as_ref();
    std::env::var_os(name).or_else(|| {
        name.to_str()?.strip_prefix("CHIRON_HORIZON_").and_then(|suffix| std::env::var_os(format!("DBX_{suffix}")))
    })
}
pub fn var(name: impl AsRef<OsStr>) -> Result<String, std::env::VarError> {
    match var_os(name) {
        Some(value) => value.into_string().map_err(std::env::VarError::NotUnicode),
        None => Err(std::env::VarError::NotPresent),
    }
}
fn error(e: impl std::fmt::Display) -> String {
    format!("Profile migration stopped; original data unchanged: {e}")
}

pub fn old_application_running() -> bool {
    let system = sysinfo::System::new_all();
    system.processes().values().any(|p| {
        let name = p.name().to_string_lossy().to_lowercase();
        matches!(name.as_str(), "dbx" | "dbx.exe" | "dbx-web" | "dbx-web.exe")
    })
}
fn copy_tree(source: &Path, destination: &Path) -> Result<(), String> {
    std::fs::create_dir(destination).map_err(error)?;
    crate::protected_file::restrict(destination)?;
    for entry in std::fs::read_dir(source).map_err(error)? {
        let entry = entry.map_err(error)?;
        let kind = entry.file_type().map_err(error)?;
        let target = destination.join(entry.file_name());
        if kind.is_symlink() {
            return Err(error("profile contains a symbolic link; review it before migration"));
        }
        if kind.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else if kind.is_file() {
            std::fs::copy(entry.path(), &target).map_err(error)?;
            crate::protected_file::restrict(&target)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let executable = entry.metadata().map_err(error)?.permissions().mode() & 0o100;
                std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o600 | executable))
                    .map_err(error)?;
            }
        } else {
            return Err(error("profile contains a special file; close the old app before migration"));
        }
    }
    Ok(())
}
fn table_exists(connection: &Connection, name: &str) -> Result<bool, String> {
    connection
        .query_row("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1", [name], |_| Ok(()))
        .optional()
        .map(|v| v.is_some())
        .map_err(error)
}
/// Move a serialized absolute profile path without letting the host platform
/// change the separator style that was stored in the profile.  A profile can
/// originate from the WebView or another OS, so `Path::join` alone would turn
/// a POSIX value such as `/old/profile/image.png` into a mixed-separator value
/// when migration runs on Windows.
fn relocate_serialized_path(path: &str, source: &str, destination: &str) -> Option<String> {
    let suffix = path.strip_prefix(source)?;
    if !suffix.is_empty() && !suffix.starts_with(['/', '\\']) {
        return None;
    }
    Some(format!("{destination}{suffix}"))
}

fn relocated_profile_path(path: &str, source: &Path, destination: &Path) -> Option<String> {
    let source = source.to_string_lossy();
    let destination = destination.to_string_lossy();

    // Use the exact representation first. On Windows, also accept a stored
    // forward-slash path and produce a forward-slash target path; this is the
    // form used by WebView-originated settings and portable profiles.
    relocate_serialized_path(path, &source, &destination).or_else(|| {
        let source_forward = source.replace('\\', "/");
        let destination_forward = destination.replace('\\', "/");
        relocate_serialized_path(path, &source_forward, &destination_forward)
    })
}

fn relocate_paths(value: &mut serde_json::Value, source: &Path, destination: &Path) -> bool {
    let mut changed = false;
    match value {
        serde_json::Value::Object(map) => {
            for (key, value) in map {
                if key == "_encryptedAiSecrets" {
                    continue;
                }
                if matches!(value, serde_json::Value::Object(_) | serde_json::Value::Array(_)) {
                    changed |= relocate_paths(value, source, destination);
                } else if key.to_lowercase().contains("path") || key.to_lowercase().ends_with("dir") {
                    if let Some(path) = value.as_str() {
                        if let Some(relocated) = relocated_profile_path(path, source, destination) {
                            *value = serde_json::Value::String(relocated);
                            changed = true;
                        }
                    }
                }
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                changed |= relocate_paths(item, source, destination);
            }
        }
        _ => {}
    }
    changed
}
fn profile_stamp(path: &Path) -> Result<Vec<(PathBuf, u64, std::time::SystemTime)>, String> {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(path).map_err(error)? {
        let entry = entry.map_err(error)?;
        let meta = std::fs::symlink_metadata(entry.path()).map_err(error)?;
        entries.push((entry.path(), meta.len(), meta.modified().map_err(error)?));
        if meta.is_dir() {
            entries.extend(profile_stamp(&entry.path())?);
        }
    }
    entries.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(entries)
}
fn migrate_database(stage: &Path, source: &Path, destination: &Path) -> Result<(), String> {
    let old = stage.join("dbx.db");
    if !old.exists() {
        return Ok(());
    }
    let mut connection = Connection::open_with_flags(&old, OpenFlags::SQLITE_OPEN_READ_WRITE).map_err(error)?;
    let integrity: String = connection.query_row("PRAGMA quick_check", [], |r| r.get(0)).map_err(error)?;
    if integrity != "ok" {
        return Err(error("copied database failed integrity validation"));
    }
    // Keep encrypted envelopes/keys unchanged. Validate before making the new profile available.
    for (table, column) in
        [("ai_configs", "config_json"), ("ai_config", "config_json"), ("ai_provider_configs", "config_json")]
    {
        if !table_exists(&connection, table)? {
            continue;
        }
        let columns: Vec<String> = connection
            .prepare(&format!("PRAGMA table_info({table})"))
            .map_err(error)?
            .query_map([], |r| r.get(1))
            .map_err(error)?
            .collect::<Result<_, _>>()
            .map_err(error)?;
        if !columns.iter().any(|c| c == column) {
            continue;
        }
        let mut stmt = connection.prepare(&format!("SELECT {column} FROM {table}")).map_err(error)?;
        let records = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(error)?;
        for record in records {
            let value: serde_json::Value = serde_json::from_str(&record.map_err(error)?).map_err(error)?;
            crate::ai_secrets::validate_saved_secret(stage, &value).map_err(error)?;
        }
    }
    let tx = connection.transaction().map_err(error)?;
    for table in ["app_state", "state_store"] {
        if table_exists(&tx, table)? {
            // Only namespace keys are renamed. Queries, history, payloads and ciphertext are not rewritten.
            tx.execute(
                &format!(
                    "UPDATE {table} SET key='chiron-horizon'||substr(key,4) WHERE key LIKE 'dbx-%' OR key LIKE 'dbx:%'"
                ),
                [],
            )
            .map_err(error)?;
        }
    }
    // Relocate only explicit absolute profile paths in structured settings/configuration.
    // History, statement text, encrypted payloads and connection/model IDs stay byte-identical.
    for (table, column) in
        [("app_settings", "settings_json"), ("app_state", "value_json"), ("connections", "config_json")]
    {
        if !table_exists(&tx, table)? {
            continue;
        }
        let mut stmt = tx.prepare(&format!("SELECT rowid,{column} FROM {table}")).map_err(error)?;
        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))
            .map_err(error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(error)?;
        drop(stmt);
        for (id, text) in rows {
            if let Ok(mut value) = serde_json::from_str::<serde_json::Value>(&text) {
                if relocate_paths(&mut value, source, destination) {
                    tx.execute(
                        &format!("UPDATE {table} SET {column}=?1 WHERE rowid=?2"),
                        rusqlite::params![value.to_string(), id],
                    )
                    .map_err(error)?;
                }
            }
        }
    }
    tx.commit().map_err(error)?;
    connection.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);").map_err(error)?;
    drop(connection);
    std::fs::rename(old, stage.join("chiron-horizon.db")).map_err(error)?;
    // Checkpointed sidecars are no longer needed in this task-owned staging copy.
    for suffix in ["-wal", "-shm"] {
        let path = stage.join(format!("dbx.db{suffix}"));
        if path.exists() {
            std::fs::remove_file(path).map_err(error)?;
        }
    }
    Ok(())
}
/// Copy once; never overwrite a new profile and never alter/delete the source.
/// The caller must resolve explicit/portable overrides before invoking this.
pub fn migrate_profile(source: &Path, destination: &Path, old_running: bool) -> Result<bool, String> {
    if destination.exists() || !source.exists() {
        return Ok(false);
    }
    if old_running {
        return Err(error("close the previous application and retry"));
    }
    let parent = destination.parent().ok_or_else(|| error("invalid profile destination"))?;
    std::fs::create_dir_all(parent).map_err(error)?;
    let migration_lock = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(false)
        .open(parent.join(format!(".{}-migration.lock", destination.file_name().unwrap().to_string_lossy())))
        .map_err(error)?;
    migration_lock.try_lock_exclusive().map_err(|_| error("another profile migration is active"))?;
    if destination.exists() {
        return Ok(false);
    }
    let before = profile_stamp(source)?;
    let stage = parent.join(format!(".chiron-horizon-migration-{}", uuid::Uuid::new_v4()));
    copy_tree(source, &stage)?;
    if before != profile_stamp(source)? {
        return Err(error("source changed while copying; close all old application processes and retry"));
    }
    migrate_database(&stage, source, destination)?;
    if old_application_running() {
        return Err(error("the previous application started while copying; retry after closing it"));
    }
    // The marker lives only in the copied profile. A failed stage is retained for diagnosis.
    std::fs::write(stage.join("chiron-profile-migration.json"), b"{\"version\":1,\"source\":\"com.dbx.app\"}")
        .map_err(error)?;
    if destination.exists() {
        return Err(error("destination appeared during migration; it was not overwritten"));
    }
    // On Windows rename already fails if the destination exists. Unix rename is protected
    // by our startup migration lock, acquired by migrate_default_profile.
    std::fs::rename(stage, destination).map_err(error)?;
    Ok(true)
}
pub fn migrate_default_profile() -> Result<(), String> {
    if var_os("CHIRON_HORIZON_DATA_DIR").is_some() {
        return Ok(());
    }
    #[cfg(windows)]
    if std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("portable.chiron-horizon").exists() || d.join("portable.dbx").exists()))
        .unwrap_or(false)
    {
        return Ok(());
    }
    let base = dirs::data_dir().ok_or_else(|| error("cannot resolve application data directory"))?;
    let destination = base.join(APP_ID);
    if destination.exists() || !base.join(OLD_APP_ID).exists() {
        return Ok(());
    }
    let lock_path = base.join(".chiron-horizon-migration.lock");
    let lock = std::fs::OpenOptions::new().write(true).create(true).truncate(false).open(&lock_path).map_err(error)?;
    lock.try_lock_exclusive().map_err(|_| error("another migration is active; retry when it finishes"))?;
    if old_application_running() {
        return Err(error("close the previous application and retry"));
    }
    #[cfg(target_os = "macos")]
    {
        // WKWebView keeps persistent browser data outside Application Support.
        let home = dirs::home_dir().ok_or_else(|| error("cannot resolve WebView directory"))?;
        for folder in ["Library/WebKit"] {
            let root = home.join(folder);
            let source = root.join(OLD_APP_ID);
            let target = root.join(APP_ID);
            if source.exists() && !target.exists() {
                let staging = root.join(format!(".chiron-horizon-webview-{}", uuid::Uuid::new_v4()));
                let before = profile_stamp(&source)?;
                copy_tree(&source, &staging)?;
                if before != profile_stamp(&source)? {
                    return Err(error(
                        "WebView storage changed while copying; close old application helpers and retry",
                    ));
                }
                if target.exists() {
                    return Err(error("WebView destination appeared during migration"));
                }
                std::fs::rename(staging, target).map_err(error)?;
            }
        }
    }
    migrate_profile(&base.join(OLD_APP_ID), &destination, false)?;
    drop(lock); // OS lock is released on exit or interruption; the lock file can safely remain.
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    fn fixture() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let root = tempfile::tempdir().unwrap();
        let old = root.path().join("old");
        let new = root.path().join("new");
        std::fs::create_dir(&old).unwrap();
        let c = Connection::open(old.join("dbx.db")).unwrap();
        c.execute_batch("CREATE TABLE app_state(key TEXT PRIMARY KEY,value_json TEXT); INSERT INTO app_state VALUES ('dbx-theme','dark'); CREATE TABLE history(query TEXT); INSERT INTO history VALUES ('COUNT dbx_user_collection;');").unwrap();
        (root, old, new)
    }
    #[test]
    fn copy_preserves_source_history_and_namespaces() {
        let (_root, old, new) = fixture();
        assert!(migrate_profile(&old, &new, false).unwrap());
        assert!(old.join("dbx.db").exists());
        let c = Connection::open(new.join("chiron-horizon.db")).unwrap();
        assert_eq!(
            c.query_row("SELECT value_json FROM app_state WHERE key='chiron-horizon-theme'", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "dark"
        );
        assert_eq!(
            c.query_row("SELECT query FROM history", [], |r| r.get::<_, String>(0)).unwrap(),
            "COUNT dbx_user_collection;"
        );
        assert!(!migrate_profile(&old, &new, false).unwrap());
    }
    #[test]
    fn missing_source_and_existing_destination_are_not_imported() {
        let root = tempfile::tempdir().unwrap();
        let absent = root.path().join("absent");
        let new = root.path().join("new");
        assert!(!migrate_profile(&absent, &new, false).unwrap());
        let (_r, old, existing) = fixture();
        std::fs::create_dir(&existing).unwrap();
        assert!(!migrate_profile(&old, &existing, true).unwrap());
        assert!(!existing.join("chiron-horizon.db").exists());
    }
    #[test]
    fn interrupted_staging_is_preserved_and_retry_succeeds() {
        let (root, old, new) = fixture();
        let interrupted = root.path().join(".chiron-horizon-migration-interrupted");
        std::fs::create_dir(&interrupted).unwrap();
        std::fs::write(interrupted.join("partial"), b"retain").unwrap();
        assert!(migrate_profile(&old, &new, false).unwrap());
        assert_eq!(std::fs::read(interrupted.join("partial")).unwrap(), b"retain");
    }
    #[test]
    fn explicit_profile_database_prefers_current_then_legacy() {
        let (_r, old, _new) = fixture();
        assert_eq!(storage_db_path(&old), old.join("dbx.db"));
        std::fs::write(old.join("chiron-horizon.db"), b"current").unwrap();
        assert_eq!(storage_db_path(&old), old.join("chiron-horizon.db"));
    }
    #[cfg(unix)]
    #[test]
    fn symlink_copy_failure_never_exposes_destination() {
        let (_r, old, new) = fixture();
        std::os::unix::fs::symlink("dbx.db", old.join("link")).unwrap();
        assert!(migrate_profile(&old, &new, false).is_err());
        assert!(!new.exists());
        assert!(old.join("dbx.db").exists());
    }
    #[test]
    fn encrypted_credentials_require_original_key_and_preserve_envelope() {
        for mode in ["valid", "missing", "wrong"] {
            let (_r, old, new) = fixture();
            let key = "original-test-key-with-at-least-32-characters";
            let payload = crate::state_persistence::EncryptedPayload::encrypt(b"test credential data", key).unwrap();
            let value = serde_json::json!({"_encryptedAiSecrets":payload}).to_string();
            let c = Connection::open(old.join("dbx.db")).unwrap();
            c.execute_batch("CREATE TABLE ai_configs(id TEXT PRIMARY KEY,config_json TEXT);").unwrap();
            c.execute("INSERT INTO ai_configs VALUES ('stable-id',?1)", [&value]).unwrap();
            drop(c);
            if mode != "missing" {
                std::fs::write(
                    old.join("ai-master.key"),
                    if mode == "valid" { key } else { "wrong-test-key-with-at-least-32-characters" },
                )
                .unwrap();
                crate::protected_file::restrict(&old.join("ai-master.key")).unwrap();
            }
            let result = migrate_profile(&old, &new, false);
            if mode == "valid" {
                assert!(result.unwrap());
                let c = Connection::open(new.join("chiron-horizon.db")).unwrap();
                assert_eq!(
                    c.query_row("SELECT config_json FROM ai_configs WHERE id='stable-id'", [], |r| r
                        .get::<_, String>(0))
                        .unwrap(),
                    value
                );
            } else {
                assert!(result.is_err());
                assert!(!new.exists());
            }
            assert!(old.join("dbx.db").exists());
        }
    }
    #[test]
    fn new_environment_wins_and_legacy_is_fallback() {
        let suffix = format!("MIGRATION_TEST_{}", uuid::Uuid::new_v4().simple());
        let new = format!("CHIRON_HORIZON_{suffix}");
        let old = format!("DBX_{suffix}");
        std::env::set_var(&old, "old");
        assert_eq!(var(&new).unwrap(), "old");
        std::env::set_var(&new, "new");
        assert_eq!(var(&new).unwrap(), "new");
        std::env::set_var(&new, "");
        assert_eq!(var(&new).unwrap(), "");
        std::env::remove_var(new);
        std::env::remove_var(old);
    }
    #[test]
    fn profile_paths_move_but_identifiers_and_query_text_do_not() {
        let source = Path::new("/old/profile");
        let target = Path::new("/new/profile");
        let mut value = serde_json::json!({"id":"dbx-model", "query":"COUNT dbx_collection;", "backgroundImage":{"path":"/old/profile/image.png"},"driver_store_dir":"/outside/profile","_encryptedAiSecrets":{"path":"/old/profile/opaque"}});
        assert!(relocate_paths(&mut value, source, target));
        assert_eq!(value["backgroundImage"]["path"], "/new/profile/image.png");
        assert_eq!(value["driver_store_dir"], "/outside/profile");
        assert_eq!(value["id"], "dbx-model");
        assert_eq!(value["query"], "COUNT dbx_collection;");
        assert_eq!(value["_encryptedAiSecrets"]["path"], "/old/profile/opaque");
    }
    #[test]
    fn serialized_profile_paths_keep_their_separator_style() {
        assert_eq!(
            relocate_serialized_path(
                r"C:\Users\old\profile\image.png",
                r"C:\Users\old\profile",
                r"C:\Users\new\profile",
            ),
            Some(r"C:\Users\new\profile\image.png".to_owned())
        );
        assert_eq!(
            relocate_serialized_path("C:/Users/old/profile/image.png", "C:/Users/old/profile", "C:/Users/new/profile",),
            Some("C:/Users/new/profile/image.png".to_owned())
        );
        assert_eq!(
            relocate_serialized_path(
                "C:/Users/old/profile-copy/image.png",
                "C:/Users/old/profile",
                "C:/Users/new/profile"
            ),
            None
        );
    }
    #[test]
    fn empty_old_profile_copies_without_inventing_database_data() {
        let root = tempfile::tempdir().unwrap();
        let old = root.path().join("old");
        let new = root.path().join("new");
        std::fs::create_dir(&old).unwrap();
        assert!(migrate_profile(&old, &new, false).unwrap());
        assert!(new.is_dir());
        assert!(!new.join("chiron-horizon.db").exists());
        assert!(old.is_dir());
    }
    #[test]
    fn running_old_app_blocks_copy() {
        let (_r, old, new) = fixture();
        assert!(migrate_profile(&old, &new, true).is_err());
        assert!(!new.exists());
    }
    #[test]
    fn corrupt_database_keeps_destination_absent() {
        let (_r, old, new) = fixture();
        std::fs::write(old.join("dbx.db"), b"invalid").unwrap();
        assert!(migrate_profile(&old, &new, false).is_err());
        assert!(!new.exists());
    }
}

/// Self-hosted web profiles use a separate historical location.
pub fn migrate_web_profile(destination: &Path) -> Result<(), String> {
    if var_os("CHIRON_HORIZON_DATA_DIR").is_some() {
        return Ok(());
    }
    let source = dirs::home_dir().ok_or_else(|| error("cannot resolve home"))?.join(".dbx-web");
    migrate_profile(&source, destination, old_application_running())?;
    Ok(())
}
pub fn is_legacy_encrypted_format(format: &str) -> bool {
    format == "dbx-encrypted"
}

pub const OLD_EXPORT_IDENTITY_MAGIC: &[u8] = b"DBXEI";
pub const OLD_SYNC_FORMAT: &str = "dbx-encrypted-sync-snapshot";

/// Explicit and portable profiles are not imported or renamed. Keep opening their
/// existing database; never create an empty replacement beside an old database.
pub fn storage_db_path(directory: &Path) -> PathBuf {
    let current = directory.join("chiron-horizon.db");
    let previous = directory.join("dbx.db");
    if !current.exists() && previous.exists() {
        previous
    } else {
        current
    }
}

/// Apply once at executable startup so argument parsers also accept legacy names.
pub fn install_environment_compatibility() {
    for (key, value) in std::env::vars_os() {
        if let Some(suffix) = key.to_str().and_then(|k| k.strip_prefix("DBX_")) {
            let current = format!("CHIRON_HORIZON_{suffix}");
            if std::env::var_os(&current).is_none() {
                std::env::set_var(current, value);
            }
        }
    }
}

pub const OLD_SQLSERVER_LINKED_SCHEMA_PREFIX: &str = "__dbx_sqlserver_linked__:";
