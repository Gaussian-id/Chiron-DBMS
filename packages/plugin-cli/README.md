# @chiron-horizon/plugin-cli

Precompiled `chiron-horizon-plugin` CLI for creating and packaging Chiron Horizon plugins. Installing this package does not compile the CLI and does not require a Chiron Horizon source checkout.

```bash
npm install --global @chiron-horizon/plugin-cli
chiron-horizon-plugin create my-plugin
```

Or run it without a global installation:

```bash
npx @chiron-horizon/plugin-cli create my-plugin
```

The package selects a precompiled binary for macOS, Linux, or Windows and bundles the matching Rust and Go Chiron Horizon plugin SDK sources. Frontend-only plugins, including the Svelte template, require only Node.js. Rust and Go are needed only when the plugin itself has a Rust or Go backend.

```bash
chiron-horizon-plugin create my-plugin --template frontend
chiron-horizon-plugin create my-svelte-plugin --template svelte
chiron-horizon-plugin create my-rust-plugin --template rust
chiron-horizon-plugin create my-go-plugin --template go
chiron-horizon-plugin package my-plugin
chiron-horizon-plugin dev --path my-plugin --port 5190
```

The `dev` subcommand requires Node.js 22+ and runs the bundled browser development runtime, without Chiron Horizon or source-tree dependencies. It supports frontend-only workbenches and Rust/Go backends, with JSONL or framed transport. Optional `[dev]` `ui_build` and `ui_watch` command arrays configure project builds. Development credentials are stored locally as plaintext under `.chiron-horizon-dev/` (or `--data-dir`). Other commands retain their existing Node requirements.
