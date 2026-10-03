#[test]
fn version_exits_without_initializing_storage_or_transport() {
    let directory = tempfile::tempdir().unwrap();
    let output = std::process::Command::new(env!("CARGO_BIN_EXE_chiron-horizon-mcp"))
        .arg("--version")
        .env("CHIRON_HORIZON_DATA_DIR", directory.path().join("must-not-exist"))
        .env("CHIRON_HORIZON_WEB_URL", "not a URL")
        .env("CHIRON_HORIZON_MCP_TRANSPORT", "invalid")
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(output.status.success());
    assert_eq!(
        String::from_utf8(output.stdout).unwrap(),
        format!("chiron-horizon-mcp {}\n", env!("CARGO_PKG_VERSION"))
    );
    assert!(output.stderr.is_empty());
    assert!(!directory.path().join("must-not-exist").exists());
}
