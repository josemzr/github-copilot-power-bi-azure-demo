# Validation

The repository validation covers:

## Backend

- Configuration modes and required values.
- Azure-style boolean casing.
- Sample payload contract.
- HTTPS-only signed report links.
- Enterprise `day_totals` validation.
- Current-to-legacy compatibility mapping.
- Stable placeholder rows when breakdown arrays are empty.
- Dependency audit.

## Infrastructure

- Bicep compilation.
- Shell syntax.
- Managed identity and RBAC declarations.
- HTTPS, TLS, FTPS, Storage, Key Vault, Application Insights, and Log Analytics configuration.

## Power BI Project

`node scripts/validate-pbip.mjs` verifies:

- PBIP, PBIR, PBISM, platform, and report JSON parsing.
- Absence of `.pbi` caches and macOS metadata.
- Protected compatibility endpoint and `ApiKeyName="code"`.
- Absence of local `File.Contents` data sources.
- Every visual table/column/measure reference against TMDL.

The imported project contains:

- 3 pages.
- 42 visuals.
- 15 model tables.
- 77 semantic visual references.
- 28 unique semantic references.

## Azure smoke tests

After deployment, `scripts/smoke-test.sh` verifies:

- Anonymous health.
- 401 for unauthenticated native metrics.
- 401 for unauthenticated compatibility metrics.
- Authenticated Enterprise records.
- Legacy compatibility fields.
- 401 for unauthenticated refresh.
- Authenticated refresh and Blob persistence.
- Existence of `latest.json`.
