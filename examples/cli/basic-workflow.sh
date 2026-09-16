#!/usr/bin/env bash
set -euo pipefail

# Basic Chiron Horizon CLI workflow.
# Replace "local" with one of your saved connection names.

CONNECTION="${CHIRON_HORIZON_CONNECTION:-local}"

echo "==> Checking local Chiron Horizon setup"
chiron-horizon doctor

echo "==> Listing connections"
chiron-horizon connections list --json

echo "==> Listing tables"
chiron-horizon schema list "$CONNECTION" --json

echo "==> Running a read-only query"
chiron-horizon query "$CONNECTION" "select 1 as ok" --json

echo "==> Building schema context for prompts"
chiron-horizon context "$CONNECTION" --tables users,orders
