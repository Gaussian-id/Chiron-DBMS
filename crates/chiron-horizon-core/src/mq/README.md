# Message Queue Admin Module

Rust implementation of the Apache Pulsar management API.

## Module layout

```text
mq/
├── mod.rs                 - MqAdminRegistry registry
├── types.rs               - Type definitions
├── auth.rs                - Authentication, including OAuth2 caching
├── config.rs              - Configuration parsing
├── port.rs                - MessageQueueAdmin trait
├── service.rs             - Service-layer functions
└── adapters/
    ├── pulsar.rs          - Pulsar implementation
    ├── kafka.rs           - Kafka implementation (Java agent)
    ├── rabbitmq.rs        - RabbitMQ implementation (native Go agent)
    ├── rocketmq.rs        - RocketMQ implementation (native Go agent)
    └── pulsar_version.rs  - Version detection
```

## Core trait

```rust
#[async_trait]
pub trait MessageQueueAdmin: Send + Sync {
    async fn list_tenants(&self) -> Result<Vec<TenantInfo>, String>;
    async fn list_namespaces(&self, tenant: &str) -> Result<Vec<NamespaceInfo>, String>;
    async fn list_topics(&self, ns: &NamespaceRef, opts: ListTopicsOpts) -> Result<Vec<TopicInfo>, String>;
    // ... 45 more methods
}
```

## Example

```rust
// AppState rewrites the admin URL to a local forwarded endpoint when an SSH
// or proxy transport layer is active.
let config = state.mq_admin_config_for_connection(&connection.id, &connection).await?;

let adapter = state.mq_registry.get_or_build_config(&connection.id, config).await?;
let tenants = adapter.list_tenants().await?;
```

Business code should normally reuse the `mq_*_core` functions in `service.rs`.
Use `MqAdminRegistry` directly only when composing lower-level capabilities.

## Feature flag

```toml
[features]
default = ["mq-admin"]
mq-admin = []
```

## Documentation

See `docs/mq-index.md` for the complete guide.
