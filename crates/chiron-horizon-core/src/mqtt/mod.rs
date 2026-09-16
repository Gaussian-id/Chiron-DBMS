//! MQTT module: broker connection management and message subscription/publishing.
//!
//! ## Architecture
//! ```text
//! Chiron Horizon frontend (Vue)
//!     │ Tauri invoke
//!     ▼
//! src-tauri/src/commands/mqtt_cmd.rs  (Tauri command entry point)
//!     │
//!     ▼
//! crates/chiron-horizon-core/src/mqtt/service.rs  (shared core logic)
//!     │
//!     ▼
//! crates/chiron-horizon-core/src/mqtt/client.rs   (rumqttc client wrapper)
//!     │
//!     ▼
//! MQTT Broker (EMQX / Mosquitto / HiveMQ / ...)
//! ```

pub mod client;
pub mod service;
pub mod types;
