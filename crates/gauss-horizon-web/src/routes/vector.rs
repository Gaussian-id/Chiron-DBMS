use std::sync::Arc;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde::Deserialize;

use crate::error::AppError;
use crate::state::WebState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChironDbRequest {
    pub connection_id: String,
    pub request: gauss_horizon_core::db::chirondb::Request,
}

pub async fn chirondb_request(
    State(state): State<Arc<WebState>>,
    headers: HeaderMap,
    Json(req): Json<ChironDbRequest>,
) -> Result<Json<gauss_horizon_core::db::chirondb::Reply>, AppError> {
    if super::mcp_policy::is_mcp_request(&headers) {
        return Err(AppError::from(
            "ChironQL is not available through MCP; use the guarded ChironDB workspace".to_string(),
        ));
    }
    gauss_horizon_core::db::chirondb::run(&state.app, &req.connection_id, req.request)
        .await
        .map(Json)
        .map_err(AppError::from)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorCollectionRequest {
    pub connection_id: String,
    pub database: String,
    pub collection: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorDatabaseRequest {
    pub connection_id: String,
    pub database: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorRenameCollectionRequest {
    pub connection_id: String,
    pub database: String,
    pub collection: String,
    pub new_name: String,
}

async fn ensure_writable(state: &WebState, connection_id: &str, action: &str) -> Result<(), AppError> {
    if let Some(name) = gauss_horizon_core::query::connection_readonly_name(&state.app, connection_id).await {
        return Err(AppError::from(format!(
            "Read-only mode: connection '{}' has read-only protection enabled. {} blocked.",
            name, action
        )));
    }
    Ok(())
}

pub async fn collection_detail(
    State(state): State<Arc<WebState>>,
    Json(req): Json<VectorCollectionRequest>,
) -> Result<Json<gauss_horizon_core::db::vector_driver::CollectionInfo>, AppError> {
    gauss_horizon_core::schema::get_vector_collection_detail_core(
        &state.app,
        &req.connection_id,
        &req.database,
        &req.collection,
    )
    .await
    .map(Json)
    .map_err(AppError::from)
}

pub async fn drop_database(
    State(state): State<Arc<WebState>>,
    headers: HeaderMap,
    Json(req): Json<VectorDatabaseRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let database = super::mcp_policy::resolve_database(&state, &headers, &req.connection_id, &req.database).await?;
    super::mcp_policy::ensure_dangerous_write(&state, &headers, &req.connection_id, &database, "Drop database").await?;
    ensure_writable(&state, &req.connection_id, "Drop database").await?;
    gauss_horizon_core::schema::drop_vector_database_core(&state.app, &req.connection_id, &database)
        .await
        .map_err(AppError::from)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn drop_collection(
    State(state): State<Arc<WebState>>,
    headers: HeaderMap,
    Json(req): Json<VectorCollectionRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let database = super::mcp_policy::resolve_database(&state, &headers, &req.connection_id, &req.database).await?;
    super::mcp_policy::ensure_dangerous_write(&state, &headers, &req.connection_id, &database, "Drop collection")
        .await?;
    ensure_writable(&state, &req.connection_id, "Drop collection").await?;
    gauss_horizon_core::schema::drop_vector_collection_core(&state.app, &req.connection_id, &database, &req.collection)
        .await
        .map_err(AppError::from)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn rename_collection(
    State(state): State<Arc<WebState>>,
    headers: HeaderMap,
    Json(req): Json<VectorRenameCollectionRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let database = super::mcp_policy::resolve_database(&state, &headers, &req.connection_id, &req.database).await?;
    super::mcp_policy::ensure_dangerous_write(&state, &headers, &req.connection_id, &database, "Rename collection")
        .await?;
    ensure_writable(&state, &req.connection_id, "Rename collection").await?;
    gauss_horizon_core::schema::rename_vector_collection_core(
        &state.app,
        &req.connection_id,
        &database,
        &req.collection,
        &req.new_name,
    )
    .await
    .map_err(AppError::from)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}
