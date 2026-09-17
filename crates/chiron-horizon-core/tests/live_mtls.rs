#[tokio::test]
#[ignore = "requires the remote Chiron Horizon mTLS smoke-test containers and local client certificates"]
async fn live_mysql_mtls_connection_succeeds() {
    let url = chiron_horizon_core::legacy::var("CHIRON_HORIZON_LIVE_MYSQL_MTLS_URL")
        .expect("CHIRON_HORIZON_LIVE_MYSQL_MTLS_URL");
    let ca = chiron_horizon_core::legacy::var("CHIRON_HORIZON_LIVE_MYSQL_MTLS_CA").ok();

    let pool =
        chiron_horizon_core::db::mysql::connect_with_ca_cert(&url, ca.as_deref(), std::time::Duration::from_secs(5))
            .await
            .unwrap();
    let result =
        chiron_horizon_core::db::mysql::execute_query(&pool, "SELECT label FROM mtls_smoke WHERE id = 1", false)
            .await
            .unwrap();

    assert_eq!(result.rows[0][0], serde_json::json!("mysql mtls ok"));
}

#[tokio::test]
#[ignore = "requires the remote Chiron Horizon mTLS smoke-test containers and local client certificates"]
async fn live_postgres_mtls_connection_succeeds() {
    let url = chiron_horizon_core::legacy::var("CHIRON_HORIZON_LIVE_POSTGRES_MTLS_URL")
        .expect("CHIRON_HORIZON_LIVE_POSTGRES_MTLS_URL");

    let pool = chiron_horizon_core::db::postgres::connect(&url, std::time::Duration::from_secs(5)).await.unwrap();
    let result = chiron_horizon_core::db::postgres::execute_query(&pool, "SELECT label FROM mtls_smoke WHERE id = 1")
        .await
        .unwrap();

    assert_eq!(result.rows[0][0], serde_json::json!("postgres mtls ok"));
}
