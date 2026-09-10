#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUBSCRIPTION="${AZURE_SUBSCRIPTION:-}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-copilot-enterprise-metrics}"
LOCATION="${AZURE_LOCATION:-westeurope}"
PARAMETERS_FILE=""
EXPECTED_MODE="${EXPECTED_DATA_SOURCE_MODE:-enterprise-report}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --subscription) SUBSCRIPTION="$2"; shift 2 ;;
    --resource-group) RESOURCE_GROUP="$2"; shift 2 ;;
    --location) LOCATION="$2"; shift 2 ;;
    --parameters) PARAMETERS_FILE="$2"; shift 2 ;;
    --expected-mode) EXPECTED_MODE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$PARAMETERS_FILE" ]]; then
  echo "A local parameters file is required. Copy infra/enterprise.bicepparam.example and pass --parameters." >&2
  exit 2
fi
if [[ "$PARAMETERS_FILE" != /* ]]; then
  PARAMETERS_FILE="$REPOSITORY_ROOT/$PARAMETERS_FILE"
fi
if [[ ! -f "$PARAMETERS_FILE" ]]; then
  echo "Parameters file not found: $PARAMETERS_FILE" >&2
  exit 2
fi

if [[ -n "$SUBSCRIPTION" ]]; then
  az account set --subscription "$SUBSCRIPTION"
fi

ACTIVE_SUBSCRIPTION="$(az account show --query name -o tsv)"
echo "Deploying to subscription: $ACTIVE_SUBSCRIPTION"
echo "Resource group: $RESOURCE_GROUP"
echo "Location: $LOCATION"

if ! az group show --name "$RESOURCE_GROUP" >/dev/null 2>&1; then
  az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --tags application=github-copilot-enterprise-metrics environment=demo managed-by=bicep \
    --output none
fi

DEPLOYMENT_NAME="copilot-powerbi-functions-$(date -u +%Y%m%d%H%M%S)"
az deployment group create \
  --name "$DEPLOYMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$REPOSITORY_ROOT/infra/main.bicep" \
  --parameters "$PARAMETERS_FILE" \
  --parameters location="$LOCATION" \
  --output none

FUNCTION_APP="$(az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DEPLOYMENT_NAME" \
  --query properties.outputs.functionAppName.value \
  -o tsv)"

pushd "$REPOSITORY_ROOT/backend" >/dev/null
npm ci --silent
npm test
func azure functionapp publish "$FUNCTION_APP" --typescript
popd >/dev/null

"$REPOSITORY_ROOT/scripts/smoke-test.sh" \
  --resource-group "$RESOURCE_GROUP" \
  --function-app "$FUNCTION_APP" \
  --expected-mode "$EXPECTED_MODE"

echo
echo "Deployment completed."
echo "Function App: $FUNCTION_APP"
echo "Health: https://${FUNCTION_APP}.azurewebsites.net/api/health"
echo "Metrics: https://${FUNCTION_APP}.azurewebsites.net/api/metrics"
echo "PBIP compatibility: https://${FUNCTION_APP}.azurewebsites.net/api/compatibility-metrics"
