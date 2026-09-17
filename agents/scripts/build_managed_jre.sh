#!/usr/bin/env bash
set -euo pipefail

# jlink produces a self-contained Java 21 runtime for JDBC agents.  The script
# runs on the matching target runner, so it never cross-runs an untrusted JDK.
OUT_DIR="${1:?Usage: build_managed_jre.sh <output-dir> <platform>}"
PLATFORM="${2:?Usage: build_managed_jre.sh <output-dir> <platform>}"
case "$PLATFORM" in
  macos-aarch64|macos-x64|windows-x64|linux-x64) ;;
  *) echo "Unsupported managed JRE platform: $PLATFORM" >&2; exit 2 ;;
esac

JLINK_BIN="${JAVA_HOME:?JAVA_HOME is required}/bin/jlink"
JMODS="${JAVA_HOME}/jmods"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT
RUNTIME_DIR="$WORK_DIR/runtime"
MODULES='java.base,java.sql,java.sql.rowset,java.naming,java.management,java.desktop,java.security.jgss,java.security.sasl,jdk.security.auth,jdk.security.jgss,jdk.charsets,jdk.unsupported,java.scripting,java.compiler,jdk.crypto.ec'
"$JLINK_BIN" --module-path "$JMODS" --add-modules "$MODULES" --strip-debug --no-header-files --no-man-pages --compress=zip-6 --output "$RUNTIME_DIR"
"$RUNTIME_DIR/bin/java" -version
mkdir -p "$OUT_DIR"
OUTPUT="$OUT_DIR/chiron-horizon-jre-21-${PLATFORM}.tar.zst"
if command -v zstd >/dev/null; then
  tar -C "$WORK_DIR" -cf - runtime | zstd -q -19 --long=27 -o "$OUTPUT"
else
  echo "zstd is required to produce the managed JRE archive" >&2
  exit 1
fi
printf 'Built %s\n' "$OUTPUT"
