#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:?Usage: build_go_release_agents.sh <output-dir>}"
ROOT_DIR="$(pwd)"
VERSION="${CHIRON_HORIZON_VERSION:-$(python3 -c 'import json; print(json.load(open("src-tauri/tauri.conf.json", encoding="utf-8"))["version"])')}"
mkdir -p "$OUT_DIR"

MODULES=(
  cassandra:agents/drivers/cassandra-go
  hive:agents/drivers/hive-go
  argo:agents/drivers/argo-go
  oracle:agents/drivers/oracle-go
  xugu:agents/drivers/xugu
  kingbase:agents/drivers/kingbase-go
  iotdb:agents/drivers/iotdb
  neo4j:agents/drivers/neo4j-go
  vastbase:agents/drivers/vastbase-go
  rabbitmq:agents/drivers/rabbitmq
  rocketmq:agents/drivers/rocketmq
  zookeeper:agents/drivers/zookeeper
  etcd:agents/drivers/etcd-go
  etcd2:agents/drivers/etcd2-go
)
TARGETS=(
  macos-aarch64:darwin:arm64
  macos-x64:darwin:amd64
  linux-x64:linux:amd64
  windows-x64:windows:amd64
)

for module in "${MODULES[@]}"; do
  key="${module%%:*}"
  directory="${module#*:}"
  (cd "$directory" && go test ./...)
  for target in "${TARGETS[@]}"; do
    IFS=: read -r platform goos goarch <<<"$target"
    extension=""
    if [[ "$goos" == "windows" ]]; then extension=".exe"; fi
    output="${OUT_DIR}/chiron-horizon-agent-${key}-${VERSION}-${platform}${extension}"
    echo "Building ${key} for ${platform}"
    (cd "$directory" && CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" go build -trimpath -ldflags='-s -w' -o "$ROOT_DIR/$output" .)
  done
done
