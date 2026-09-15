use axum::Json;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSchemaSyncSqlRequest {
    pub diffs: Vec<gauss_horizon_core::schema_diff::TableDiff>,
    pub function_diffs: Option<Vec<gauss_horizon_core::schema_diff::FunctionDiff>>,
    pub sequence_diffs: Option<Vec<gauss_horizon_core::schema_diff::SequenceDiff>>,
    pub rule_diffs: Option<Vec<gauss_horizon_core::schema_diff::RuleDiff>>,
    pub owner_diffs: Option<Vec<gauss_horizon_core::schema_diff::OwnerDiff>>,
    pub database_type: gauss_horizon_core::models::connection::DatabaseType,
    pub target_schema: Option<String>,
    pub cascade_delete: Option<bool>,
    pub source_dialect: Option<String>,
    pub field_mappings: Option<Vec<gauss_horizon_core::schema_diff::FieldMapping>>,
    pub enable_rollback: Option<bool>,
}

pub async fn generate_schema_sync_plan(
    Json(req): Json<GenerateSchemaSyncSqlRequest>,
) -> Json<gauss_horizon_core::schema_diff::SchemaSyncSqlPlan> {
    Json(gauss_horizon_core::schema_diff::generate_schema_sync_sql_plan(
        &req.diffs,
        req.function_diffs.as_deref().unwrap_or_default(),
        req.sequence_diffs.as_deref().unwrap_or_default(),
        req.rule_diffs.as_deref().unwrap_or_default(),
        req.owner_diffs.as_deref().unwrap_or_default(),
        req.database_type,
        req.target_schema.as_deref(),
        req.cascade_delete.unwrap_or(false),
        req.source_dialect.as_deref().and_then(gauss_horizon_core::sql_dialect::descriptor::DialectKind::from_label),
        req.field_mappings.as_deref().unwrap_or(&[]),
        req.enable_rollback.unwrap_or(false),
    ))
}

pub async fn prepare_schema_diff(
    Json(options): Json<gauss_horizon_core::schema_diff::SchemaDiffPreparationOptions>,
) -> Json<gauss_horizon_core::schema_diff::SchemaDiffPreparation> {
    Json(gauss_horizon_core::schema_diff::prepare_schema_diff(options))
}

pub async fn generate_schema_sync_sql(Json(req): Json<GenerateSchemaSyncSqlRequest>) -> Json<String> {
    Json(gauss_horizon_core::schema_diff::generate_schema_sync_sql(
        &req.diffs,
        req.function_diffs.as_deref().unwrap_or_default(),
        req.sequence_diffs.as_deref().unwrap_or_default(),
        req.rule_diffs.as_deref().unwrap_or_default(),
        req.owner_diffs.as_deref().unwrap_or_default(),
        req.database_type,
        req.target_schema.as_deref(),
        req.cascade_delete.unwrap_or(false),
        req.source_dialect.as_deref().and_then(gauss_horizon_core::sql_dialect::descriptor::DialectKind::from_label),
        req.field_mappings.as_deref().unwrap_or(&[]),
    ))
}
