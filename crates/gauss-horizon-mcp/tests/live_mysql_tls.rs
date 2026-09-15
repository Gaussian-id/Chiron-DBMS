use std::{path::Path, sync::Arc};

use gauss_horizon_mcp::{GaussHorizonMcpServer, LocalBackend, McpScope};
use rmcp::{model::CallToolRequestParams, ServiceExt};
use serde_json::{json, Map};

#[tokio::test]
#[ignore = "requires GAUSS_HORIZON_LIVE_MCP_DATA_DIR with a MySQL connection using ssl-mode=preferred"]
async fn mysql_preferred_tls_with_self_signed_certificate_keeps_mcp_alive() {
    let data_dir = gauss_horizon_core::legacy::var("GAUSS_HORIZON_LIVE_MCP_DATA_DIR").expect("set GAUSS_HORIZON_LIVE_MCP_DATA_DIR");
    let connection_name = gauss_horizon_core::legacy::var("GAUSS_HORIZON_LIVE_MCP_CONNECTION").expect("set GAUSS_HORIZON_LIVE_MCP_CONNECTION");
    let database = gauss_horizon_core::legacy::var("GAUSS_HORIZON_LIVE_MCP_DATABASE").expect("set GAUSS_HORIZON_LIVE_MCP_DATABASE");
    let backend =
        Arc::new(LocalBackend::open(&Path::new(&data_dir).join("gauss-horizon.db")).await.expect("open copied Gauss Horizon storage"));
    let server = GaussHorizonMcpServer::with_runtime_options(backend, McpScope::default(), false);
    let (server_transport, client_transport) = tokio::io::duplex(16 * 1024);
    let server_task = tokio::spawn(async move { server.serve(server_transport).await });
    let client = ().serve(client_transport).await.expect("initialize MCP client");
    let arguments = json!({
        "connection_name": connection_name,
        "database": database,
        "sql": "SELECT 1 AS tls_probe",
    })
    .as_object()
    .cloned()
    .unwrap_or_else(Map::new);

    let result = client
        .peer()
        .call_tool(CallToolRequestParams::new("gauss_horizon_execute_query").with_arguments(arguments))
        .await
        .expect("MCP server must stay alive while executing the TLS query");
    let text = result.content[0].as_text().expect("text query result").text.clone();
    assert_ne!(result.is_error, Some(true), "preferred TLS query failed: {text}");
    assert!(text.contains("tls_probe") && text.contains('1'), "unexpected query result: {text}");

    client.cancel().await.expect("close MCP client");
    server_task.abort();
}
