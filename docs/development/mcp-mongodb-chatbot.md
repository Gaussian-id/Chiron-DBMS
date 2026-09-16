# MongoDB chatbot through Chiron Horizon MCP

Date: 2026-09-14. Branch: `codex/chiron-horizon-0.1.0`.

Kevin requested a simple chatbot using the MongoDB connection already saved in Chiron Horizon. The runnable example is in [`examples/mcp/mongo-chatbot`](../../examples/mcp/mongo-chatbot/README.md).

## Implementation and verified behavior

The loopback browser UI talks to a Python standard-library server. An OpenAI-compatible model chooses tools; the server routes those calls through a real standalone Chiron Horizon MCP 0.1.0 process over stdio. MCP alone reads saved MongoDB credentials and accesses MongoDB. A fixed connection scope and `CHIRON_HORIZON_MCP_ALLOW_WRITES=0` apply to this child process without changing the profile's global policy. No direct MongoDB driver is imported by the example.

At Kevin's request, the example uses his saved **Test Mongo** connection from the current `id.chiron.horizon` profile. This is separate from the earlier disposable MongoDB E2E test and does not use the legacy application profile. No saved AI configuration was available; Kevin chose a provider to configure in the local form.

Observed through real MCP:

- Server handshake reports `chiron-horizon` version `0.1.0`.
- Database discovery succeeds, including `sample_analytics`.
- Collection discovery in that database returns `transactions`, `accounts`, and `customers`.
- The browser UI loads at the printed loopback URL, with database selection and MCP connection status.

Six unit tests pass for routing, forced connection identity, local-only output by default, explicit output sharing, rejected system-role history injection and bounded tool loops. These tests use fake model responses and are not live model acceptance. Branding audit passes for 4,791 owned text files; `git diff --check` passes.

## Live model acceptance: passed for the count workflow

The first attempt used `https://api.tokenrouter.com/v1` with `z-ai/glm-5.3-free` and ended with a generic request-failed message without a displayed tool result. Its underlying error was not exposed; authentication failure or timeout is not asserted as the cause. A password-field presence check appeared empty through the browser observation API, but this is not dependable evidence of the actual credential sent and no credential value was read or recorded.

After Kevin requested a retry with the updated local configuration, the selected model was `MiniMax-M3` on the same endpoint. Tool-result sharing was enabled by the user. The browser sent: “Berapa jumlah dokumen pada koleksi accounts di database sample_analytics? Gunakan MCP untuk menghitung, jangan mengambil isi dokumen.”

Observed end to end in the browser:

1. The real model selected `chiron_horizon_execute_query` with `database: sample_analytics` and `sql: db.accounts.countDocuments({})`.
2. The Chiron Horizon MCP process executed the query through the saved Test Mongo connection.
3. The tool result card showed one row, with `count` equal to **1746**.
4. The model answered in Indonesian that the collection contained **1,746 documents**. The UI reported **1 MCP call**.

This establishes a real natural-language → model tool selection → Chiron Horizon MCP → saved MongoDB connection → result → model answer workflow. Only a count was requested, no document bodies or writes. It does not certify every model, query, conversation flow or desktop chatbot integration. The failed first attempt remains separate from this passing retry. Provider-generated reasoning tags appeared in the answer area, an output-presentation limitation of this minimal demo.

After successful testing, Kevin requested closing all local servers. The demo and its MCP child were stopped; port 61270 was verified free. API keys/settings are held only in browser/request memory and must be re-entered after page reload. Tool results stay local unless the user enables sharing; prompts, selected database and conversational history still go to the provider. Previously generated assistant summaries remain in history. This is a development example, separate from the desktop AI UI; no desktop rebuild, installation, package publication or profile migration was performed for it.

## Evidence and follow-up

- Example startup log: `/tmp/chiron-horizon-mongo-chatbot.log` (startup metadata only).
- Unit-test log: `/tmp/chiron-horizon-mongo-chatbot-tests.log`.
- Local URL for this run: `http://127.0.0.1:61270/` (historical; server now stopped).
- Observed live acceptance: one `chiron_horizon_execute_query` call; `db.accounts.countDocuments({})` returned `1746`; the model answer matched the MCP result.
- Earlier independent protocol/database evidence: [MongoDB MCP E2E](mcp-mongodb-e2e.md).
