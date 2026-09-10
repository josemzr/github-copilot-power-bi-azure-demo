# Adapted Power BI Project

Open:

```text
GitHub Copilot - Telemetry Sample (Metrics with KPI).pbip
```

The file and artifact-folder names are retained from upstream so internal relative references remain stable. Power BI
displays the report and semantic model as **GitHub Copilot Enterprise Metrics**.

## What was preserved

- All report pages.
- All 42 visuals and all 77 semantic references.
- All visual container IDs.
- Visual types, positions, sizes, formatting, themes, and images.
- Semantic-model table and column names.
- Calculated columns and KPI formulas.
- Relationships and date tables.
- Page order and hidden disclaimer page.

## What was changed

- `Sample Dashboard` is now `Enterprise Dashboard`.
- `KPI - Savings` is now `KPI - Savings Scenario`.
- The `Telemetry Details` visual title is now `Enterprise Usage Details`.
- The hidden `source` query uses the protected Azure Functions compatibility endpoint instead of a local sample file.

## First open

1. Retrieve the dedicated compatibility key:

   ```bash
   az functionapp function keys list \
     -g <RESOURCE_GROUP> \
     -n <FUNCTION_APP> \
     --function-name compatibilityMetrics \
     --query '["power-bi-compat"]' -o tsv
   ```

2. Open the `.pbip` in Power BI Desktop.
3. Select **Transform data**.
4. Refresh the hidden `source` query.
5. Select **Web API** authentication.
6. Paste the `power-bi-compat` key.
7. Apply the credential to `https://<FUNCTION_APP>.azurewebsites.net`.
8. Select privacy level **Organizational**.
9. Select **Close & Apply** and refresh.

If the host was previously configured as Anonymous, clear its entry under **File → Options and settings → Data
source settings → Global permissions** before refreshing.

## Compatibility behavior

The upstream dashboard expects the legacy Copilot Metrics API. The current Enterprise report uses a different
`day_totals` schema. The Azure Function translates current records into the legacy object shape while preserving
correctness:

- Exact equivalents are mapped directly.
- Enterprise-wide breakdowns are labeled as aggregate values.
- Missing dimensions use `No data reported` and zero values.
- No user counts are inferred for IDE/language dimensions when GitHub does not provide them.
- Summary active users, adoption-phase engagement, activity, LOC, and pull-request totals use current report fields.

Some detail visuals can therefore show zero or `No data reported`, especially when GitHub returns empty
`totals_by_ide`, `totals_by_feature`, or `totals_by_language_feature` arrays. This is expected and prevents a blank
array from breaking the original Power Query expansions.

## KPI page

The KPI page is a scenario model, not an audited ROI calculation. Review the `config` table values before presenting:

- `total_devs`
- `avg_hourly_salary`
- `annual_work_weeks`
- `average_weekly_hour_savings`

The default values originate from the upstream sample.

## Publishing

After a successful Desktop refresh:

1. Save the PBIP.
2. Publish the report to the intended Power BI workspace.
3. Open semantic-model settings in Power BI Service.
4. Configure the web data source as **Web API** using `power-bi-compat`.
5. Set the privacy level to **Organizational**.
6. Schedule refresh after the Azure Function timer completes at 06:00 UTC.

For production, prefer Power BI access to private Blob/ADLS through Entra ID instead of a long-lived Function key.
