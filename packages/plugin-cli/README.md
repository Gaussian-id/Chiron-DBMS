# @gauss-horizon/plugin-cli

Precompiled `gauss-horizon-plugin` CLI for creating and packaging Gauss Horizon plugins. Installing this package does not compile the CLI and does not require a Gauss Horizon source checkout.

```bash
npm install --global @gauss-horizon/plugin-cli
gauss-horizon-plugin create my-plugin
```

Or run it without a global installation:

```bash
npx @gauss-horizon/plugin-cli create my-plugin
```

The package selects a precompiled binary for macOS, Linux, or Windows and bundles the matching Rust and Go Gauss Horizon plugin SDK sources. Frontend-only plugins, including the Svelte template, require only Node.js. Rust and Go are needed only when the plugin itself has a Rust or Go backend.

```bash
gauss-horizon-plugin create my-plugin --template frontend
gauss-horizon-plugin create my-svelte-plugin --template svelte
gauss-horizon-plugin create my-rust-plugin --template rust
gauss-horizon-plugin create my-go-plugin --template go
gauss-horizon-plugin package my-plugin
gauss-horizon-plugin dev --path my-plugin --port 5190
```

The `dev` subcommand requires Node.js 22+ and runs the bundled browser development runtime, without Gauss Horizon or source-tree dependencies. It supports frontend-only workbenches and Rust/Go backends, with JSONL or framed transport. Optional `[dev]` `ui_build` and `ui_watch` command arrays configure project builds. Development credentials are stored locally as plaintext under `.gauss-horizon-dev/` (or `--data-dir`). Other commands retain their existing Node requirements.
