# Mongo Chat through Chiron Horizon MCP

A local Python/browser demo connecting an OpenAI-compatible tool-calling model to a saved MongoDB connection through the standalone Chiron Horizon MCP server. It does not use a direct MongoDB driver. This example is separate from the desktop's built-in AI UI.

## Run

Requires Python 3 and a built MCP binary:

```sh
cargo build -p chiron-horizon-mcp --no-default-features --features sqlite-bundled
python3 examples/mcp/mongo-chatbot/server.py \
  --profile '/absolute/path/to/your/Chiron Horizon/profile' \
  --connection-id 'saved-mongodb-connection-id'
```

Open the loopback URL printed at startup. Select a database, enter the provider base URL, model and API key in the browser, and send a question such as:

> Berapa jumlah dokumen pada koleksi accounts? Gunakan MCP untuk menghitung, jangan mengambil isi dokumen.

The provider must support OpenAI-compatible `chat/completions` function tools. The endpoint can also be the full chat-completions URL. Remote providers require HTTPS; HTTP is accepted for loopback providers. API keys are optional only when the selected provider supports unauthenticated access. The example never persists provider settings or keys; re-enter them after reloading the page.

## Scope and data handling

- A dedicated MCP child process uses the selected saved profile, forces the specified connection and disables writes. It does not change global MCP policy or saved AI configuration.
- Only database/collection discovery, schema context and query tools are exposed to the model. MongoDB queries use shell syntax, such as `db.accounts.countDocuments({})`.
- Prompts, conversation text and the selected database name go to the provider. Raw tool output stays local by default and appears in result cards. The explicit checkbox permits sending tool output to the provider for summarization. Previously generated assistant summaries remain part of conversation history.
- Credentials for MongoDB remain inside MCP/profile handling. The model cannot choose a different saved connection. The database selector supplies a default database; it is not a database-level access restriction.
- The browser server binds to `127.0.0.1`, checks Host/Origin and a per-process request token, and disables response caching. It is a local development example, not a hosted multi-user service.
- Five model rounds and five tools per round bound a conversation. No automatic request retries or write approval workflow is implemented. Stop the Python process to stop the demo and its MCP child.

## Tests

```sh
python3 -m unittest discover -s examples/mcp/mongo-chatbot -p 'test_*.py' -v
```

These are unit tests with fake model responses, covering routing, connection scope, output sharing and loop bounds. They do not replace a live model test. Real MongoDB/MCP protocol acceptance is recorded separately in [the E2E report](../../../docs/development/mcp-mongodb-e2e.md).
