use std::sync::Arc;

use gauss_horizon_mcp::{
    http::serve_streamable_http, with_legacy_discovery_fallback, GaussHorizonBackend, GaussHorizonMcpServer, LocalBackend, McpTransport,
    RuntimeConfig, WebBackend,
};
use rmcp::ServiceExt;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    gauss_horizon_core::legacy::install_environment_compatibility();
    let runtime = RuntimeConfig::from_environment_and_args()?;
    let backend: Arc<dyn GaussHorizonBackend> = if let Ok(base_url) = gauss_horizon_core::legacy::var("GAUSS_HORIZON_WEB_URL") {
        Arc::new(
            WebBackend::new(base_url, gauss_horizon_core::legacy::var("GAUSS_HORIZON_WEB_PASSWORD").unwrap_or_default())
                .map_err(std::io::Error::other)?,
        )
    } else {
        let db_path = gauss_horizon_mcp::paths::storage_db_path().map_err(std::io::Error::other)?;
        Arc::new(LocalBackend::open(&db_path).await.map_err(std::io::Error::other)?)
    };
    match runtime.transport {
        McpTransport::Stdio => {
            let transport = with_legacy_discovery_fallback(rmcp::transport::stdio());
            let service = GaussHorizonMcpServer::new(backend).serve(transport).await?;
            service.waiting().await?;
            Ok(())
        }
        McpTransport::StreamableHttp => {
            let http = runtime.http.ok_or_else(|| std::io::Error::other("missing HTTP MCP runtime configuration"))?;
            serve_streamable_http(backend, http).await?;
            Ok(())
        }
    }
}
