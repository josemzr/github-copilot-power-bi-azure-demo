# Security

## Data classification

The deployment contains real aggregate metrics from the configured Enterprise. It does not contain prompts, source
code, private keys, JWTs, installation tokens, or signed report URLs. Treat the metrics as confidential Enterprise
operational data.

Real Copilot metrics can include user, organization, team, editor, language, and repository dimensions. Classify the
result before production ingestion and apply minimization, retention, and access-control requirements.

## Threat model

| Threat | Control |
| --- | --- |
| GitHub private key exposed in Power BI | Key remains in Key Vault and is resolved only by managed identity |
| Installation token copied from logs | Tokens are never logged or returned |
| Production data exposed anonymously | Metrics and compatibility triggers require function-specific keys |
| Overprivileged GitHub App | Installation and permissions limited to the required scope |
| Storage data exposed publicly | Blob public access disabled; current policy also disables the public endpoint |
| Storage account keys leaked | Subscription policy disables shared-key access |
| Unauthorized refresh | Function host key required |
| Secret committed to Git | `.gitignore`, CI review, and documented secret handling |
| Metrics tampering | Immutable timestamped snapshots and restricted write identity in target design |
| Excessive telemetry cost/data leakage | Structured metadata-only logs; payload bodies excluded |

## Implemented controls

- HTTPS only.
- Minimum TLS 1.2.
- FTPS disabled.
- System-assigned managed identity.
- Key Vault RBAC authorization and purge protection.
- `Key Vault Secrets User` scoped to the vault.
- `Storage Blob Data Contributor` scoped to the storage account.
- Storage public blob access disabled.
- Storage shared keys plus Storage/Key Vault public networks are normally disabled by policy; temporarily exempted for this RG.
- Application Insights connected to Log Analytics.
- Refresh endpoint closed by default.
- Any approved Policy exception is narrowly scoped and has a fixed expiration.
- No secrets in Bicep parameter files, source, Power Query, or documentation.

## Intentional demo exception

The metrics endpoint can be internet reachable but requires a function-specific key. Production should prefer private
networking and Entra-authenticated access to the curated Storage data.

## Production hardening checklist

- Set `PUBLIC_METRICS_ENABLED=false`.
- Use private endpoints for Storage and Key Vault.
- Integrate compute with the landing-zone VNet.
- Add private DNS zones and resolution tests.
- Restrict Function inbound access or remove the metrics HTTP endpoint.
- Remove the temporary policy exemption and use identity-based private host Storage.
- Use Power BI/Fabric identity-based access to the persisted data.
- Configure diagnostic settings and alert routing.
- Apply resource locks after deployment stabilizes.
- Define retention and deletion requirements.
- Add Defender for Cloud and policy compliance review.
- Use workload identity federation for CI/CD.
- Add dependency and code scanning.
- Add an incident runbook for GitHub App key compromise.
- Review GitHub App permissions quarterly.

## Logging policy

Allowed:

- Invocation name and result.
- Mode.
- Record count.
- HTTP status from external services.
- Duration and retry count.
- Non-sensitive blob names.

Forbidden:

- JWTs.
- Installation tokens.
- Private keys.
- Function/API keys.
- Complete metrics payloads.
- User-level records.

## Secret scanning before commit

```bash
git grep -nE \
  '(BEGIN (RSA )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]+|AccountKey=|x-functions-key)'
```

Review any match manually. Examples in documentation must use placeholders only.
