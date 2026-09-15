#!/usr/bin/env bash
set -euo pipefail

# Basic Gauss Horizon CLI workflow.
# Replace "local" with one of your saved connection names.

CONNECTION="${GAUSS_HORIZON_CONNECTION:-local}"

echo "==> Checking local Gauss Horizon setup"
gauss-horizon doctor

echo "==> Listing connections"
gauss-horizon connections list --json

echo "==> Listing tables"
gauss-horizon schema list "$CONNECTION" --json

echo "==> Running a read-only query"
gauss-horizon query "$CONNECTION" "select 1 as ok" --json

echo "==> Building schema context for prompts"
gauss-horizon context "$CONNECTION" --tables users,orders
