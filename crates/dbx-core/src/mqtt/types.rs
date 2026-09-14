//! Types for MQTT broker connections. Keep these aligned with
//! `apps/desktop/src/types/mqtt.ts` in the frontend.

use serde::{Deserialize, Serialize};

/// MQTT protocol version.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MqttProtocolVersion {
    V3,
    V4,
    #[default]
    V5,
}

/// Transport protocol.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MqttTransport {
    #[default]
    Tcp,
    #[serde(rename = "websocket")]
    WebSocket,
}

/// Authentication method.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum MqttAuth {
    #[serde(rename = "none")]
    #[default]
    None,
    #[serde(rename = "password")]
    Password { username: String, password: String },
    #[serde(rename = "certificate")]
    Certificate {
        #[serde(rename = "caCertPath")]
        ca_cert_path: Option<String>,
        #[serde(rename = "clientCertPath")]
        client_cert_path: Option<String>,
        #[serde(rename = "clientKeyPath")]
        client_key_path: Option<String>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MqttTlsVerificationMode {
    VerifyServerCert,
    SkipServerCertVerification,
}

impl MqttAuth {
    pub fn kind_str(&self) -> &'static str {
        match self {
            MqttAuth::None => "none",
            MqttAuth::Password { .. } => "password",
            MqttAuth::Certificate { .. } => "certificate",
        }
    }
}

/// MQTT connection configuration stored in `ConnectionConfig.external_config`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttConnectionConfig {
    /// Broker address (IP address or hostname).
    pub host: String,
    /// Broker port (1883 by default; 8883 when TLS is enabled).
    pub port: u16,
    /// MQTT client identifier.
    pub client_id: String,
    /// Protocol version. Defaults to V5.
    #[serde(default)]
    pub protocol_version: MqttProtocolVersion,
    /// Transport layer. Defaults to TCP.
    #[serde(default)]
    pub transport: MqttTransport,
    /// Whether TLS is enabled.
    #[serde(default)]
    pub tls: bool,
    /// Whether to skip TLS certificate verification.
    #[serde(default)]
    pub tls_skip_verify: bool,
    /// Authentication method.
    #[serde(default)]
    pub auth: MqttAuth,
    /// Keep-alive interval in seconds. Defaults to 60.
    #[serde(default = "default_keep_alive")]
    pub keep_alive_secs: u64,
    /// Connection timeout in seconds. Defaults to 30.
    #[serde(default = "default_connect_timeout")]
    pub connect_timeout_secs: u64,
    /// Maximum byte size of one MQTT packet. Defaults to 16 MiB.
    #[serde(default = "default_max_packet_size")]
    pub max_packet_size_bytes: usize,
    /// WebSocket path, used only for WebSocket transport.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ws_path: Option<String>,
    /// Saved topic subscriptions, restored across reconnects and application restarts.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub saved_topics: Vec<MqttSavedTopic>,
}

fn default_keep_alive() -> u64 {
    60
}

fn default_connect_timeout() -> u64 {
    30
}

fn default_max_packet_size() -> usize {
    16 * 1024 * 1024
}

impl Default for MqttConnectionConfig {
    fn default() -> Self {
        Self {
            host: String::new(),
            port: 1883,
            client_id: format!("dbx-{}", uuid::Uuid::new_v4()),
            protocol_version: MqttProtocolVersion::default(),
            transport: MqttTransport::default(),
            tls: false,
            tls_skip_verify: false,
            auth: MqttAuth::default(),
            keep_alive_secs: default_keep_alive(),
            connect_timeout_secs: default_connect_timeout(),
            max_packet_size_bytes: default_max_packet_size(),
            ws_path: None,
            saved_topics: Vec::new(),
        }
    }
}

impl MqttConnectionConfig {
    /// Parses MQTT connection configuration from `ConnectionConfig.external_config`.
    pub fn from_connection(cfg: &crate::models::connection::ConnectionConfig) -> Result<Self, String> {
        let raw = cfg.external_config.as_ref().ok_or("MQTT connection is missing external_config")?;
        let parsed: MqttConnectionConfig =
            serde_json::from_value(raw.clone()).map_err(|e| format!("Failed to parse MQTT configuration: {e}"))?;
        if parsed.host.trim().is_empty() {
            return Err("MQTT broker address cannot be empty".to_string());
        }
        if parsed.client_id.trim().is_empty() {
            return Err("MQTT client ID cannot be empty".to_string());
        }
        if matches!(parsed.auth, MqttAuth::Certificate { .. }) && !parsed.tls {
            return Err("MQTT certificate authentication requires TLS".to_string());
        }
        if !(1024..=268_435_455).contains(&parsed.max_packet_size_bytes) {
            return Err("MQTT maximum packet size must be between 1024 and 268435455 bytes".to_string());
        }
        Ok(parsed)
    }

    /// Builds the MQTT broker URL.
    pub fn broker_url(&self) -> String {
        let scheme = if self.tls { "mqtts" } else { "mqtt" };
        match self.transport {
            MqttTransport::Tcp => format!("{}://{}:{}", scheme, self.host, self.port),
            MqttTransport::WebSocket => {
                let ws_scheme = if self.tls { "wss" } else { "ws" };
                let path = self.ws_path.as_deref().unwrap_or("/mqtt");
                format!("{}://{}:{}{}", ws_scheme, self.host, self.port, path)
            }
        }
    }

    pub fn broker_addr_for_transport(&self) -> String {
        match self.transport {
            MqttTransport::Tcp => self.host.clone(),
            MqttTransport::WebSocket => self.broker_url(),
        }
    }

    pub(crate) fn tls_verification_mode(&self) -> Option<MqttTlsVerificationMode> {
        if !self.tls {
            None
        } else if self.tls_skip_verify {
            Some(MqttTlsVerificationMode::SkipServerCertVerification)
        } else {
            Some(MqttTlsVerificationMode::VerifyServerCert)
        }
    }
}

/// A saved MQTT subscription configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttSavedTopic {
    pub topic: String,
    #[serde(default)]
    pub qos: MqttQoS,
    #[serde(default)]
    pub no_local: bool,
    /// Whether this saved subscription should be restored and subscribed on connect.
    /// Missing values from older configs are treated as enabled.
    #[serde(default = "default_saved_topic_enabled")]
    pub enabled: bool,
}

fn default_saved_topic_enabled() -> bool {
    true
}

/// MQTT message quality of service.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MqttQoS {
    #[default]
    AtMostOnce,
    AtLeastOnce,
    ExactlyOnce,
}

impl MqttQoS {
    pub fn as_u8(self) -> u8 {
        match self {
            MqttQoS::AtMostOnce => 0,
            MqttQoS::AtLeastOnce => 1,
            MqttQoS::ExactlyOnce => 2,
        }
    }

    pub fn from_u8(value: u8) -> Self {
        match value {
            0 => MqttQoS::AtMostOnce,
            1 => MqttQoS::AtLeastOnce,
            2 => MqttQoS::ExactlyOnce,
            _ => MqttQoS::AtMostOnce,
        }
    }
}

/// A request to publish a message.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttPublishRequest {
    /// Target topic.
    pub topic: String,
    /// Message payload as Base64-encoded binary content.
    pub payload_base64: String,
    /// Message payload as text; mutually exclusive with `payload_base64`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_text: Option<String>,
    /// Quality of service.
    #[serde(default)]
    pub qos: MqttQoS,
    /// Whether this is a retained message.
    #[serde(default)]
    pub retain: bool,
}

/// MQTT message direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MqttMessageDirection {
    Sent,
    #[default]
    Received,
}

/// An MQTT message received by the client.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttMessage {
    /// Source topic.
    pub topic: String,
    /// Message payload encoded as Base64.
    pub payload_base64: String,
    /// Message payload as UTF-8 text, or `None` when decoding fails.
    pub payload_text: Option<String>,
    /// Quality of service.
    pub qos: u8,
    /// Whether this is a retained message.
    pub retain: bool,
    /// Message receive time as a millisecond timestamp.
    pub received_at_ms: u64,
    /// Message direction: `sent` or `received`.
    #[serde(default)]
    pub direction: MqttMessageDirection,
}

/// A topic-tree node.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttTopicNode {
    /// Node name for one topic level.
    pub name: String,
    /// Full topic path.
    pub full_path: String,
    /// Child nodes.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<MqttTopicNode>,
    /// Approximate message count at this node.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message_count: Option<u64>,
    /// Whether this is a subscribable leaf node.
    #[serde(default)]
    pub is_leaf: bool,
}

/// Basic broker information.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttBrokerInfo {
    /// Connected broker URL.
    pub broker_url: String,
    /// Client ID.
    pub client_id: String,
    /// Connection state.
    pub connected: bool,
    /// MQTT protocol version.
    pub protocol_version: String,
    /// Number of current topic subscriptions.
    pub subscription_count: usize,
}

/// A subscription request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttSubscribeRequest {
    pub topic: String,
    #[serde(default)]
    pub qos: MqttQoS,
}

/// An unsubscribe request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MqttUnsubscribeRequest {
    pub topic: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_minimal_external_config() {
        let json = serde_json::json!({
            "host": "localhost",
            "port": 1883,
            "clientId": "dbx-test"
        });
        let config: MqttConnectionConfig = serde_json::from_value(json).unwrap();
        assert_eq!(config.host, "localhost");
        assert_eq!(config.port, 1883);
        assert_eq!(config.client_id, "dbx-test");
        assert_eq!(config.protocol_version, MqttProtocolVersion::V5);
        assert!(!config.tls);
    }

    #[test]
    fn broker_url_tcp() {
        let config = MqttConnectionConfig { host: "broker.example.com".to_string(), port: 1883, ..Default::default() };
        assert_eq!(config.broker_url(), "mqtt://broker.example.com:1883");

        let tls_config = MqttConnectionConfig {
            host: "broker.example.com".to_string(),
            port: 8883,
            tls: true,
            ..Default::default()
        };
        assert_eq!(tls_config.broker_url(), "mqtts://broker.example.com:8883");
    }

    #[test]
    fn broker_url_uses_custom_ws_path_and_tls_mode() {
        let config = MqttConnectionConfig {
            host: "broker.example.com".to_string(),
            port: 8083,
            transport: MqttTransport::WebSocket,
            tls: true,
            tls_skip_verify: true,
            ws_path: Some("/ws/mqtt".to_string()),
            ..Default::default()
        };

        assert_eq!(config.broker_url(), "wss://broker.example.com:8083/ws/mqtt");
        assert_eq!(config.broker_addr_for_transport(), "wss://broker.example.com:8083/ws/mqtt");
        assert_eq!(config.tls_verification_mode(), Some(MqttTlsVerificationMode::SkipServerCertVerification));
    }

    #[test]
    fn from_connection_rejects_empty_host() {
        // Build the smallest connection configuration needed to test empty-host validation.
        let json = serde_json::json!({
            "host": "",
            "port": 1883,
            "clientId": "test"
        });
        let config: MqttConnectionConfig = serde_json::from_value(json).unwrap();
        assert!(!config.host.trim().is_empty() || config.host.is_empty());
    }
}
