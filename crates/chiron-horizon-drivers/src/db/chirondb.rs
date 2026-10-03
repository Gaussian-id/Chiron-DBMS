//! ChironDB HTTP transport and collection discovery shared with the vector driver.
use super::vector_driver::{CollectionInfo, VectorClient};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Serialize, Deserialize)]
pub struct Reply {
    pub status: u16,
    pub body: Value,
}

pub async fn send(request: reqwest::RequestBuilder) -> Result<Reply, String> {
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
