use std::path::PathBuf;

pub const STORAGE_DB_FILE_NAME: &str = "chiron-horizon.db";

/// Mirrors `dirs::data_dir()` (same call the Tauri desktop app makes) so MCP/CLI and the desktop
/// app resolve the same `chiron-horizon.db`, including under `XDG_DATA_HOME` on Linux.
pub fn app_data_dir() -> Result<PathBuf, String> {
    chiron_horizon_core::legacy::migrate_default_profile()?;
    if let Some(path) = chiron_horizon_core::legacy::var_os("CHIRON_HORIZON_DATA_DIR").filter(|value| !value.is_empty())
    {
        return Ok(PathBuf::from(path));
    }

    let base = dirs::data_dir().ok_or_else(|| {
        "Unable to resolve the user data directory. Set CHIRON_HORIZON_DATA_DIR explicitly.".to_string()
    })?;
    Ok(base.join("id.chiron.horizon"))
}

pub fn storage_db_path() -> Result<PathBuf, String> {
    Ok(chiron_horizon_core::legacy::storage_db_path(&app_data_dir()?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explicit_data_dir_wins() {
        let original = chiron_horizon_core::legacy::var_os("CHIRON_HORIZON_DATA_DIR");
        std::env::set_var("CHIRON_HORIZON_DATA_DIR", "/tmp/chiron-horizon-mcp-data");
        assert_eq!(app_data_dir().unwrap(), PathBuf::from("/tmp/chiron-horizon-mcp-data"));
        match original {
            Some(value) => std::env::set_var("CHIRON_HORIZON_DATA_DIR", value),
            None => std::env::remove_var("CHIRON_HORIZON_DATA_DIR"),
        }
    }
}
