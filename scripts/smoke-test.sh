#!/usr/bin/env bash
set -euo pipefail

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-copilot-enterprise-metrics}"
FUNCTION_APP=""
EXPECTED_MODE="${EXPECTED_DATA_SOURCE_MODE:-enterprise-report}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --resource-group) RESOURCE_GROUP="$2"; shift 2 ;;
    --function-app) FUNCTION_APP="$2"; shift 2 ;;
    --expected-mode) EXPECTED_MODE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$FUNCTION_APP" ]]; then
  FUNCTION_APP="$(az functionapp list \
    --resource-group "$RESOURCE_GROUP" \
    --query '[0].name' -o tsv)"
fi

if [[ -z "$FUNCTION_APP" ]]; then
  echo "No Function App found in $RESOURCE_GROUP." >&2
  exit 1
fi

BASE_URL="https://${FUNCTION_APP}.azurewebsites.net"
HEALTH_FILE="$(mktemp)"
METRICS_FILE="$(mktemp)"
COMPATIBILITY_FILE="$(mktemp)"
trap 'rm -f "$HEALTH_FILE" "$METRICS_FILE" "$COMPATIBILITY_FILE"' EXIT

curl --fail --silent --show-error --retry 8 --retry-delay 5 \
  "$BASE_URL/api/health" >"$HEALTH_FILE"
node -e '
  const fs = require("fs");
  const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (value.status !== "healthy" || value.mode !== process.argv[2]) process.exit(1);
' "$HEALTH_FILE" "$EXPECTED_MODE"

UNAUTHORIZED_METRICS_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  "$BASE_URL/api/metrics")"
if [[ "$UNAUTHORIZED_METRICS_STATUS" != "401" ]]; then
  echo "Expected metrics without a key to return 401; received $UNAUTHORIZED_METRICS_STATUS." >&2
  exit 1
fi

UNAUTHORIZED_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request POST "$BASE_URL/api/refresh")"
if [[ "$UNAUTHORIZED_STATUS" != "401" ]]; then
  echo "Expected refresh without a key to return 401; received $UNAUTHORIZED_STATUS." >&2
  exit 1
fi

FUNCTION_KEY="$(az functionapp keys list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$FUNCTION_APP" \
  --query functionKeys.default -o tsv)"

curl --fail --silent --show-error --retry 8 --retry-delay 5 \
  --header "x-functions-key: $FUNCTION_KEY" \
  "$BASE_URL/api/metrics" >"$METRICS_FILE"
node -e '
  const fs = require("fs");
  const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!Array.isArray(value) || value.length === 0) process.exit(1);
  if (process.argv[2] === "enterprise-report" && (value.length !== 28 || !value[0].day)) process.exit(1);
  if (process.argv[2] !== "enterprise-report" && !value[0].date) process.exit(1);
' "$METRICS_FILE" "$EXPECTED_MODE"

UNAUTHORIZED_COMPATIBILITY_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  "$BASE_URL/api/compatibility-metrics")"
if [[ "$UNAUTHORIZED_COMPATIBILITY_STATUS" != "401" ]]; then
  echo "Expected compatibility metrics without a key to return 401; received $UNAUTHORIZED_COMPATIBILITY_STATUS." >&2
  exit 1
fi

curl --fail --silent --show-error \
  --header "x-functions-key: $FUNCTION_KEY" \
  "$BASE_URL/api/compatibility-metrics" >"$COMPATIBILITY_FILE"
node -e '
  const fs = require("fs");
  const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const fields = ["date", "total_active_users", "total_engaged_users",
    "copilot_ide_code_completions", "copilot_ide_chat",
    "copilot_dotcom_chat", "copilot_dotcom_pull_requests"];
  if (!Array.isArray(value) || value.length !== 28 || fields.some(field => !(field in value[0]))) {
    process.exit(1);
  }
' "$COMPATIBILITY_FILE"

curl --fail --silent --show-error \
  --request POST \
  --header "x-functions-key: $FUNCTION_KEY" \
  "$BASE_URL/api/refresh" |
  node -e '
    let body = "";
    process.stdin.on("data", chunk => body += chunk);
    process.stdin.on("end", () => {
      const value = JSON.parse(body);
      if (!value.itemCount || !value.latestBlob || !value.historyBlob) process.exit(1);
    });
  '

CONNECTION_STRING="$(az functionapp config appsettings list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$FUNCTION_APP" \
  --query "[?name=='AzureWebJobsStorage'].value | [0]" -o tsv)"
LATEST_BLOB="$(az storage blob exists \
  --connection-string "$CONNECTION_STRING" \
  --container-name copilot-metrics \
  --name latest.json \
  --query exists -o tsv)"
if [[ "$LATEST_BLOB" != "true" ]]; then
  echo "The refresh completed but latest.json was not found." >&2
  exit 1
fi

echo "Smoke tests passed for $FUNCTION_APP."
