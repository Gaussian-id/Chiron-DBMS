//! MQTT service layer: core functions shared by Tauri commands and web routes.

use std::sync::Arc;

use super::client::MqttClient;
use super::types::*;

/// Gets or creates an MQTT client connection.
/// An MQTT connection follows a get-or-create model: one client is shared by
/// the same connection ID.
pub async fn ensure_mqtt_client(
    client: &Option<Arc<MqttClient>>,
    config: &MqttConnectionConfig,
) -> Result<Arc<MqttClient>, String> {
    if let Some(ref client) = client {
        return Ok(Arc::clone(client));
    }
    MqttClient::connect(config.clone()).await
}

/// Tests an MQTT connection.
pub async fn test_connection(config: &MqttConnectionConfig) -> Result<MqttBrokerInfo, String> {
    let client = MqttClient::connect(config.clone()).await?;
    let info = client.broker_info().await;
    client.disconnect().await;
    Ok(info)
}

/// Gets broker information.
pub async fn get_broker_info(client: &Arc<MqttClient>) -> Result<MqttBrokerInfo, String> {
    Ok(client.broker_info().await)
}

/// Subscribes to a topic.
pub async fn subscribe(client: &Arc<MqttClient>, topic: &str, qos: MqttQoS, no_local: bool) -> Result<(), String> {
    client.subscribe(topic, qos, no_local).await
}

/// Unsubscribes from a topic.
pub async fn unsubscribe(client: &Arc<MqttClient>, topic: &str) -> Result<(), String> {
    client.unsubscribe(topic).await
}

/// Publishes a message.
pub async fn publish(client: &Arc<MqttClient>, request: &MqttPublishRequest) -> Result<(), String> {
    client.publish(request).await
}

/// Lists subscribed topics.
pub async fn list_topics(client: &Arc<MqttClient>) -> Result<Vec<(String, MqttQoS)>, String> {
    Ok(client.list_topics().await)
}

/// Gets the topic tree.
pub async fn get_topic_tree(client: &Arc<MqttClient>) -> Result<MqttTopicNode, String> {
    Ok(client.build_topic_tree().await)
}

/// Gets messages.
pub async fn get_messages(
    client: &Arc<MqttClient>,
    topic_filter: Option<&str>,
    limit: usize,
) -> Result<Vec<MqttMessage>, String> {
    Ok(client.get_messages(topic_filter, limit).await)
}

/// Clears the message buffer.
pub async fn clear_messages(client: &Arc<MqttClient>) -> Result<(), String> {
    client.clear_messages().await;
    Ok(())
}
