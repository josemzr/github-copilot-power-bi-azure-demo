# Deployment

## Prerequisites

- Azure CLI.
- Bicep through Azure CLI.
- Azure Functions Core Tools 4.
- Node.js 22 or later.
- Contributor access and permission to create role assignments.
- A GitHub App installed on the target Enterprise.
- Enterprise Copilot metrics read permission.

## Local configuration files

Copy the templates:

```bash
cp infra/bootstrap.bicepparam.example infra/bootstrap.bicepparam
cp infra/enterprise.bicepparam.example infra/enterprise.bicepparam
```

`.bicepparam` files are ignored by Git. Fill the Enterprise file with the deployment's App ID, installation ID,
Enterprise slug, and Key Vault secret URI.

## Bootstrap

```bash
az login --use-device-code
az account set --subscription "<SUBSCRIPTION_NAME_OR_ID>"
az group create --name <RESOURCE_GROUP> --location <AZURE_REGION>

az deployment group create \
  --resource-group <RESOURCE_GROUP> \
  --name copilot-metrics-bootstrap \
  --template-file infra/main.bicep \
  --parameters infra/bootstrap.bicepparam \
  --parameters location=<AZURE_REGION>
```

Retrieve the generated Key Vault name:

```bash
az deployment group show \
  --resource-group <RESOURCE_GROUP> \
  --name copilot-metrics-bootstrap \
  --query properties.outputs.keyVaultName.value \
  --output tsv
```

## Upload the GitHub App private key

The operator needs `Key Vault Secrets Officer` on the vault:

```bash
az keyvault secret set \
  --vault-name <KEY_VAULT> \
  --name github-app-private-key \
  --file "/secure/path/github-app.private-key.pem" \
  --encoding utf-8
```

Use the vault name in `infra/enterprise.bicepparam`.

## Deploy Enterprise mode

```bash
./scripts/deploy.sh \
  --subscription "<SUBSCRIPTION_NAME_OR_ID>" \
  --resource-group <RESOURCE_GROUP> \
  --location <AZURE_REGION> \
  --parameters infra/enterprise.bicepparam \
  --expected-mode enterprise-report
```

The script:

1. Selects the subscription.
2. Creates the resource group when absent.
3. Deploys Bicep using the local parameter file.
4. Installs exact npm dependencies.
5. Builds and tests the backend.
6. Publishes the Function package.
7. Synchronizes HTTP and timer triggers.
8. Runs authenticated/unauthenticated smoke tests.
9. Confirms the current Blob snapshot.

## Validate without deployment

```bash
cd backend
npm ci
npm test
npm audit --omit=dev --audit-level=high

cd ..
az bicep build --file infra/main.bicep
bash -n scripts/*.sh
node scripts/validate-pbip.mjs
```

## Landing-zone policies

Some tenants prohibit public Storage/Key Vault endpoints or Storage shared keys. Do not copy policy exemptions from
another environment. Adapt the template with:

- Identity-based Function host Storage.
- VNet integration.
- Private endpoints.
- Private DNS.
- Entra-authenticated Power BI access to Blob/ADLS.

If an exception is unavoidable, it must be approved by the cloud-governance owner, narrowly scoped, and time limited.

## Rollback

Publish a known-good revision with Functions Core Tools. For complete removal, use the guarded resource-group cleanup
script documented in `docs/CLEANUP.md`.
