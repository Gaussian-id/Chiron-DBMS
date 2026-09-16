//! Live MongoDB count regressions.
//!
//! Run with a writable MongoDB server:
//! ```text
//! CHIRON_HORIZON_LIVE_MONGODB_URL='mongodb://127.0.0.1:27017' \
//!   cargo test -p chiron-horizon-core --test live_mongodb_count -- --ignored --nocapture
//! ```

use std::time::Duration;

use chiron_horizon_core::db::mongo_driver;

#[tokio::test]
#[ignore = "requires CHIRON_HORIZON_LIVE_MONGODB_URL pointing at a writable MongoDB database"]
async fn count_supports_fast_accurate_and_browser_total_paths() {
    let url =
        chiron_horizon_core::legacy::var("CHIRON_HORIZON_LIVE_MONGODB_URL").expect("CHIRON_HORIZON_LIVE_MONGODB_URL");
    let client = mongo_driver::connect(&url, Duration::from_secs(10), Duration::from_secs(60)).await.unwrap();
    let database = chiron_horizon_core::legacy::var("CHIRON_HORIZON_LIVE_MONGODB_DATABASE")
        .unwrap_or_else(|_| "chiron_horizon_live_count".to_string());
    let collection = format!("count_paths_{}", std::process::id());

    mongo_driver::insert_documents(&client, &database, &collection, r#"[{"n":1},{"n":2},{"n":3}]"#).await.unwrap();

    let fast_count = mongo_driver::count_documents(&client, &database, &collection, None, false).await.unwrap();
    let accurate_count = mongo_driver::count_documents(&client, &database, &collection, None, true).await.unwrap();
    let browser_result =
        mongo_driver::find_documents_extended_json(&client, &database, &collection, 0, 2, None, None, None, None)
            .await
            .unwrap();

    assert_eq!(fast_count, 3);
    assert_eq!(accurate_count, 3);
    assert_eq!(browser_result.total, 3);
    assert!(!browser_result.total_is_exact);
    assert_eq!(browser_result.documents.len(), 2);

    mongo_driver::drop_collection(&client, &database, &collection).await.unwrap();
}
