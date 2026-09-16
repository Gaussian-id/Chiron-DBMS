# Chiron Horizon JDBC Plugin Prototype

This is an optional sidecar plugin for Chiron Horizon. It is not bundled with the main Chiron Horizon app.

## Build

```sh
./gradlew shadowJar
cp build/libs/chiron-horizon-jdbc-plugin-all.jar lib/chiron-horizon-jdbc-plugin.jar
```

## Package for release

```sh
./package.sh
```

The package version follows the JDBC plugin version in `build.gradle` and `manifest.json`.
The package script writes one immutable `chiron-horizon-jdbc-plugin-<version>.zip` asset.

## Install for local Chiron Horizon

Copy this folder to the Chiron Horizon app data plugin directory:

```text
<Chiron Horizon app data>/plugins/jdbc
```

The folder must contain:

```text
manifest.json
bin/chiron-horizon-jdbc-plugin
lib/chiron-horizon-jdbc-plugin.jar
```

Chiron Horizon does not bundle Java or JDBC drivers. Install Java locally and add database-specific driver JAR paths in the Chiron Horizon JDBC connection form.

## MySQL-compatible cursor fetching

Chiron Horizon uses standard JDBC result-set paging, but does not automatically set Connector/J's `useCursorFetch` property.
That property enables a MySQL-specific server cursor protocol; it is not part of JDBC and may be unsupported by
MySQL-compatible servers. If a server and driver are known to support it, opt in explicitly in the connection URL:

```text
jdbc:mysql://host:3306/database?useCursorFetch=true
```

Leave the property unset for generic JDBC or compatibility drivers that need to shield non-standard server behavior.

The first-class JDBCX profile uses `io.github.jdbcx.WrappedDriver` and
`jdbcx:[extension:][vendor://host:port/database]` URLs. Install a JDBCX Maven bundle such as
`io.github.jdbcx:jdbcx-driver:0.8.0` in the Chiron Horizon JDBC driver store, together with the database vendor's JDBC driver.
JDBCX discovers delegate drivers through JDBC `ServiceLoader`/`Driver.acceptsURL`, without vendor-specific Chiron Horizon code.
Each connection selects exactly one installed JDBCX runtime bundle; Chiron Horizon excludes artifacts from every other installed
JDBCX version from that connection's classpath.

Chiron Horizon restricts JDBCX to the `help`, `var`, and `version` extensions by default. Shell, Script, Web, MCP, and other
high-privilege extensions can execute local commands or access external resources, so they require an explicit
per-connection opt-in in the connection dialog.

Some high-privilege extensions require optional runtime libraries that JDBCX deliberately does not bundle. Install
those libraries in the JDBC driver store and select them for the same connection. For JDBCX 0.8.0, MCP requires
`io.github.jdbcx:io.modelcontextprotocol:1.0.1`; use the dependency version declared by the selected JDBCX release.
