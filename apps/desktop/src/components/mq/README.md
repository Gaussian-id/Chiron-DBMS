# Message Queue Admin Components

UI components for message-queue administration.

## Components

- **MqAdminConsole.vue** - Main console shell
- **TenantsPanel.vue** - Tenant management
- **NamespacesPanel.vue** - Namespace management
- **TopicsPanel.vue** - Topic management
- **SubscriptionsPanel.vue** - Subscription management
- **MonitoringPanel.vue** - Monitoring statistics

## Usage

```vue
<template>
  <MqAdminConsole :connection-id="connectionId" />
</template>

<script setup lang="ts">
import MqAdminConsole from "@/components/mq/MqAdminConsole.vue";

const connectionId = "your-mq-connection-id";
</script>
```

## Documentation

See `docs/mq-index.md` for the complete guide.
