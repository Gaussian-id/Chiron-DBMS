use serde_json::json;
use std::sync::Arc;
use tauri::State;

use crate::commands::connection::AppState;
use chiron_horizon_core::connection::PoolKind;
use chiron_horizon_core::mqtt::service;
use chiron_horizon_core::mqtt::types::*;

/// Gets the MQTT client from the connection map.
async fn get_mqtt_client(
    state: &AppState,
    connection_id: &str,
) -> Result<Arc<chiron_horizon_core::mqtt::client::MqttClient>, String> {
    let pool = state
        .pool_handle(connection_id)
        .await
        .ok_or_else(|| format!("Connection {} is not established", connection_id))?;
    match pool {
        PoolKind::Mqtt(client) => Ok(client),
        _ => Err(format!("Connection {} is not an MQTT connection", connection_id)),
    }
}

async fn persist_mqtt_topics(
    state: &AppState,
    connection_id: &str,
    client: &chiron_horizon_core::mqtt::client::MqttClient,
) -> Result<(), String> {
    let saved_topics = client.desired_topic_configs().await;
    if !state.configs.read().await.contains_key(connection_id) {
        return Ok(());
    }
    let saved_topics = serde_json::to_value(saved_topics).map_err(|e| e.to_string())?;
    state.storage.save_connection_mqtt_saved_topics(connection_id, saved_topics.clone()).await?;
    if let Some(config) = state.configs.write().await.get_mut(connection_id) {
        let mut external_config = config.external_config.take().unwrap_or_else(|| json!({}));
        let Some(external_object) = external_config.as_object_mut() else {
            return Err("MQTT external_config must be a JSON object".to_string());
        };
        external_object.insert("savedTopics".to_string(), saved_topics);
        config.external_config = Some(external_config);
    }
    Ok(())
}
/// Gets basic broker information.
#[tauri::command]
pub async fn mqtt_get_broker_info(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<MqttBrokerInfo, String> {
    let client = get_mqtt_client(&state, &connection_id).await?;
    service::get_broker_info(&client).await
}

/// Subscribes to a topic.
#[tauri::command]
pub async fn mqtt_subscribe(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    topic: String,
    qos: Option<MqttQoS>,
    no_local: Option<bool>,
) -> Result<(), String> {
    let client = get_mqtt_client(&state, &connection_id).await?;
    service::subscribe(&client, &topic, qos.unwrap_or_default(), no_local.unwrap_or(false)).await?;
    persist_mqtt_topics(state.inner(), &connection_id, &client).await
}

/// Saves a subscription configuration without sending SUBSCRIBE to the broker.
#[tauri::command]
pub async fn mqtt_save_topic_config(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    config: MqttSavedTopic,
) -> Result<(), String> {
    let client = get_mqtt_client(&state, &connection_id).await?;
    client.save_topic_config(config).await?;
    persist_mqtt_topics(state.inner(), &connection_id, &client).await
}

/// Unsubscribes from a topic.
#[tauri::command]
pub async fn mqtt_unsubscribe(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    topic: String,
) -> Result<(), String> {
    let client = get_mqtt_client(&state, &connection_id).await?;
    service::unsubscribe(&client, &topic).await?;
    persist_mqtt_topics(state.inner(), &connection_id, &client).await
}

/// Deletes a saved subscription configuration; the caller must unsubscribe first.
#[tauri::command]
pub async fn mqtt_delete_topic_config(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    topic: String,
) -> Result<(), String> {
    let client = get_mqtt_client(&state, &connection_id).await?;
    client.delete_topic_config(&topic).await?;
    persist_mqtt_topics(state.inner(), &connection_id, &client).await
}

/// Publishes a message.
#[tauri::command]
pub async fn mqtt_publish(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    request: MqttPublishRequest,
) -> Result<(), String> {
    let client = get_mqtt_client(&state, &connection_id).await?;
    service::publish(&client, &request).await
}

/// Lists subscribed topics.
#[tauri::command]
pub async fn mqtt_list_topics(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<Vec<(String, MqttQoS)>, String> {
    let client = get_mqtt_client(&state, &connection_id).await?;
    service::list_topics(&client).await
}

/// Lists all saved subscription configurations, including disabled ones.
#[tauri::command]
pub async fn mqtt_list_saved_topic_configs(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<Vec<MqttSavedTopic>, String> {
    let client = get_mqtt_client(&state, &connection_id).await?;
    Ok(client.desired_topic_configs().await)
}

/// Gets the topic tree.
#[tauri::command]
pub async fn mqtt_get_topic_tree(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
) -> Result<MqttTopicNode, String> {
    let client = get_mqtt_client(&state, &connection_id).await?;
    service::get_topic_tree(&client).await
}

/// Gets messages.
#[tauri::command]
pub async fn mqtt_get_messages(
    state: State<'_, Arc<AppState>>,
    connection_id: String,
    topic_filter: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<MqttMessage>, String> {
    let client = get_mqtt_client(&state, &connection_id).await?;
    service::get_messages(&client, topic_filter.as_deref(), limit.unwrap_or(50)).await
}

/// Clears message history.
#[tauri::command]
pub async fn mqtt_clear_messages(state: State<'_, Arc<AppState>>, connection_id: String) -> Result<(), String> {
    let client = get_mqtt_client(&state, &connection_id).await?;
    service::clear_messages(&client).await
}
