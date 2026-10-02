use std::any::TypeId;

fn assert_same_type<Legacy: 'static, Extracted: 'static>() {
    assert_eq!(TypeId::of::<Legacy>(), TypeId::of::<Extracted>());
}

#[test]
fn extracted_crates_preserve_legacy_type_identity() {
    assert_same_type::<
        chiron_horizon_core::models::connection::ConnectionConfig,
        chiron_horizon_types::models::connection::ConnectionConfig,
    >();
    assert_same_type::<
        chiron_horizon_core::models::connection::DatabaseType,
        chiron_horizon_types::models::connection::DatabaseType,
    >();
    assert_same_type::<chiron_horizon_core::types::QueryResult, chiron_horizon_types::types::QueryResult>();
    assert_same_type::<chiron_horizon_core::db::mysql::MySqlPool, chiron_horizon_drivers::db::mysql::MySqlPool>();
    assert_same_type::<
        chiron_horizon_core::db::agent_driver::AgentDriverClient,
        chiron_horizon_drivers::db::agent_driver::AgentDriverClient,
    >();
    assert_same_type::<
        chiron_horizon_core::schema_diff::SchemaDiffPreparation,
        chiron_horizon_sql::schema_diff::SchemaDiffPreparation,
    >();
    assert_same_type::<
        chiron_horizon_core::table_structure_sql::TableStructureSqlOptions,
        chiron_horizon_sql::table_structure_sql::TableStructureSqlOptions,
    >();
    assert_same_type::<chiron_horizon_core::csv_export::CsvQuoteMode, chiron_horizon_formats::csv_export::CsvQuoteMode>(
    );
    assert_same_type::<
        chiron_horizon_core::plugins::PluginManifest,
        chiron_horizon_plugin_runtime::plugins::PluginManifest,
    >();
    assert_same_type::<chiron_horizon_core::ai::AiProvider, chiron_horizon_ai_provider::ai::AiProvider>();
    assert_same_type::<
        chiron_horizon_core::db::ssh_prompt::SshPromptRequest,
        chiron_horizon_platform::ssh_prompt::SshPromptRequest,
    >();
    assert_same_type::<
        chiron_horizon_core::db::ssh_prompt::UserInputRequest,
        chiron_horizon_platform::ssh_prompt::UserInputRequest,
    >();
}

#[test]
fn business_directories_preserve_legacy_namespaces() {
    assert_same_type::<chiron_horizon_core::storage::Storage, chiron_horizon_core::persistence::storage::Storage>();
    assert_same_type::<
        chiron_horizon_core::query_cancel::RunningTaskMetadata,
        chiron_horizon_core::query::query_cancel::RunningTaskMetadata,
    >();
}
