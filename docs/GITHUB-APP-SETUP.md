# GitHub App setup

## Why a GitHub App

A GitHub App provides installation-scoped, short-lived access. It is preferable to a personal access token because
the integration is not tied to an employee account and permissions can be limited to the installed organization or
enterprise.

## Token lifecycle

1. Azure reads the GitHub App private key from Key Vault.
2. The backend signs an RS256 JWT:
   - `iat`: current time minus 60 seconds for clock skew.
   - `exp`: no more than 10 minutes after issuance.
   - `iss`: GitHub App client ID or app ID.
3. The backend calls `POST /app/installations/{installation_id}/access_tokens`.
4. GitHub returns an installation access token valid for one hour.
5. The backend uses the installation token to call the configured metrics endpoint.
6. The token is retained only in process memory and is never logged or returned.

## Create and install the app

1. In the correct GitHub enterprise or organization, create a GitHub App owned by a non-personal administrative
   account.
2. Disable webhook delivery unless another requirement needs it.
3. Grant only the read permission required by the selected Copilot metrics endpoint. Permission labels can change;
   use the endpoint's current GitHub documentation as the source of truth.
4. Install the app only on the required organization/enterprise and repositories.
5. Record the app/client ID and installation ID.
6. Generate a private key and immediately move it into Key Vault.
7. Delete local copies after verifying the Key Vault value.

## Store the private key

```bash
az keyvault secret set \
  --vault-name <KEY_VAULT> \
  --name github-app-private-key \
  --file /secure/path/github-app.private-key.pem
```

Do not run this command from a shared shell history if the local path itself is sensitive. Never pass the PEM content
as a command-line argument.

## Configure production settings

Required values:

| Setting | Description |
| --- | --- |
| `DATA_SOURCE_MODE` | `enterprise-report` |
| `GITHUB_APP_ID` | GitHub App client ID or app ID |
| `GITHUB_INSTALLATION_ID` | Installation ID |
| `GITHUB_APP_PRIVATE_KEY` | Key Vault reference, not literal PEM |
| `GITHUB_METRICS_URL` | Enterprise 28-day report-index endpoint |
| `PUBLIC_METRICS_ENABLED` | `false` |

Example Key Vault reference:

```text
@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/github-app-private-key/)
```

The compute managed identity already has `Key Vault Secrets User` in the demo RG. Production should scope the role to
the single vault and use network restrictions appropriate to the landing zone.

## Metrics endpoint selection

The upstream PBIX expects the legacy 28-day JSON-array metrics shape. GitHub's newer usage-metrics report endpoints can
return short-lived download links and richer report files. Confirm:

- Enterprise, organization, or team scope.
- Endpoint availability for the customer's GitHub Enterprise Cloud version.
- Required organization or enterprise role.
- Whether the PBIX transformations support the returned schema.

The backend follows signed `download_links`, validates `day_totals`, deduplicates and sorts daily records, and stores
the normalized array before Power BI reads it.

## Rotation and revocation

- Rotate the private key on an agreed schedule and after any suspected exposure.
- Add the new key to GitHub and Key Vault before removing the old key.
- Restart or refresh the compute service after changing the Key Vault reference.
- Revoke installation tokens by suspending or uninstalling the app when emergency access removal is required.
- Audit GitHub App installations and Azure Key Vault access regularly.
