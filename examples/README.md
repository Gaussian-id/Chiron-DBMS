# Chiron Horizon Examples

Runnable samples for common Chiron Horizon workflows.

| Directory | What it shows |
| --- | --- |
| [cli/](cli/) | Terminal queries with `@chiron-horizon/cli` |
| [mcp/](mcp/) | MCP configs for Cursor and Claude Code |
| [docker/](docker/) | Self-hosted Docker deployment |
| [web-api/](web-api/) | Minimal HTTP API automation against Chiron Horizon Web |

## Before You Run

1. Install Chiron Horizon Desktop, or start the Docker/Web version.
2. Create at least one connection in Chiron Horizon.
3. For CLI examples, install the CLI:

```bash
npm install -g @chiron-horizon/cli
```

4. For MCP examples, install the MCP server:

```bash
npm install -g @chiron-horizon/mcp-server
```

MCP connection access and execution permissions are configured centrally in **Chiron Horizon Settings → MCP**. The client examples intentionally contain no permission or connection-scope environment variables.

## Suggested Learning Path

1. Read [Getting Started](https://distribution-disabled.invalid/en/docs/getting-started)
2. Try the CLI workflow in `cli/basic-workflow.sh`
3. Copy an MCP config from `mcp/` into your project
4. If you self-host Chiron Horizon, use `docker/docker-compose.yml`
5. For custom integrations, inspect `web-api/automation.sh`

More docs:

- [CLI reference](https://distribution-disabled.invalid/en/docs/cli)
- [MCP integration](https://distribution-disabled.invalid/en/docs/mcp)
- [Web API reference](https://distribution-disabled.invalid/en/docs/web-api)
