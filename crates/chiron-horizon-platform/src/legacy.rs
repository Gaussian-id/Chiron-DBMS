//! Legacy environment names and persisted markers accepted during migration.
use std::ffi::{OsStr, OsString};
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
pub const OLD_SQLSERVER_LINKED_SCHEMA_PREFIX: &str = "__dbx_sqlserver_linked__:";
