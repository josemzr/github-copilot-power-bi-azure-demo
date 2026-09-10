# Power BI setup

## Requirements

- Power BI Desktop on Windows for editing the PBIX.
- A Power BI Pro license or an appropriate Fabric/Power BI capacity for sharing.
- Permission to create or publish to a workspace.
- Permission to configure semantic-model credentials and refresh.

Power BI Desktop is not available natively on macOS. The repository preserves the upstream PBIX and also includes an
adapted PBIP project whose visuals remain bound to the original table and column names.

## Recommended: open the adapted PBIP

Create a function-specific compatibility key and retrieve it only for the Power BI credential dialog:

```bash
az functionapp function keys set \
  -g <RESOURCE_GROUP> \
  -n <FUNCTION_APP> \
  --function-name compatibilityMetrics \
  --key-name power-bi-compat

az functionapp function keys list \
  -g <RESOURCE_GROUP> \
  -n <FUNCTION_APP> \
  --function-name compatibilityMetrics \
  --query '["power-bi-compat"]' -o tsv
```

1. Open:

   ```text
   powerbi/GitHub Copilot - Telemetry Sample (Metrics with KPI).pbip
   ```

2. Select **Home → Transform data → Transform data**.
3. Select the hidden `source` query and refresh it.
4. When prompted for credentials, select **Web API**.
5. Enter the `power-bi-compat` key.
6. Apply the credential at the Function host level.
7. Select privacy level **Organizational**.
8. Select **Close & Apply**.
9. Refresh the report.

The existing dashboard pages, visuals, formatting, measures, and relationships are retained. The source query uses
`ApiKeyName="code"`, so the key is stored in Power BI's credential store rather than embedded in TMDL.

The compatibility mapping uses exact current metrics where equivalents exist. Dimensions absent from the new
aggregate schema use zero, empty arrays, or explicit aggregate labels; review the mapping table in the root README.

## Native Enterprise daily-summary table

For new visuals using the current field names:

1. Create a `power-bi-read` key for the `metrics` function.
2. Add a blank query.
3. Paste `queries/azure_enterprise_daily_summary.pq`.
4. Authenticate using **Web API** and `power-bi-read`.

This table avoids compatibility aliases and should be preferred for future report development.

## Publish manually

1. In Power BI Desktop, select **Publish**.
2. Sign in to the correct tenant.
3. Select an existing workspace, not **My workspace**, for a shared customer demonstration.
4. Open the published semantic model in Power BI Service.
5. Open **Settings → Data source credentials**.
6. Set the web source to Web API and enter the dedicated function key.
7. Configure a daily refresh if desired.
8. Verify the report after the first service-side refresh.

No on-premises gateway is required for a publicly reachable HTTPS web source.

## Import from Power BI Service

Use **Workspace → New item/Upload → PBIX** when the PBIX already has the correct source. Editing the query source is
still easier in Power BI Desktop.

## Production data source

Do not point Power BI anonymously at real metrics. Preferred patterns are:

1. Power BI reads curated Blob/Data Lake/SQL data using an Entra identity.
2. A Fabric pipeline or dataflow retrieves data from an authenticated internal API.
3. A custom connector implements the organization's approved authentication method.

The Azure Function should obtain the GitHub token and data. Power BI should never obtain or receive the installation
token.

## Automated publication

Automated PBIX import requires:

- A Power BI workspace ID.
- A service principal or managed identity permitted by tenant settings.
- Workspace Admin or Member access as appropriate.
- Power BI REST API access.

Typical automation calls the Power BI imports endpoint or `New-PowerBIReport` from MicrosoftPowerBIMgmt. Store the
client credential in a CI secret or use workload federation; do not commit it.

## Workspace requirements

Power BI publication requires a provisioned workspace, an appropriate Power BI/Fabric license or capacity, and
permission to publish and configure semantic-model credentials. These are separate from the Azure subscription that
hosts the Function.
