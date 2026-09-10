#!/usr/bin/env bash
set -euo pipefail

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-copilot-enterprise-metrics}"
CONFIRM=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --resource-group) RESOURCE_GROUP="$2"; shift 2 ;;
    --confirm) CONFIRM="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ "$CONFIRM" != "$RESOURCE_GROUP" ]]; then
  echo "Cleanup is blocked. Re-run with --confirm '$RESOURCE_GROUP'." >&2
  exit 2
fi

az group delete --name "$RESOURCE_GROUP" --yes --no-wait
echo "Deletion requested only for resource group: $RESOURCE_GROUP"
