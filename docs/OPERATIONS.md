# Operations

## Service endpoints

| Endpoint | Authentication | Purpose |
| --- | --- | --- |
| `/api/health` | Anonymous | Availability and non-sensitive configuration |
| `/api/metrics` | Function-specific key | Normalized real Enterprise day totals |
| `/api/compatibility-metrics` | Function-specific key | Legacy contract used by the adapted PBIP |
| `/api/refresh` | Function key | Manual GitHub collection and Blob persistence |

## Daily checks

```bash
./scripts/smoke-test.sh \
  --resource-group <RESOURCE_GROUP> \
  --function-app <FUNCTION_APP>

az functionapp show \
  --resource-group <RESOURCE_GROUP> \
  --name <FUNCTION_APP> \
  --query '{state:state,host:defaultHostName}'
```

## Logs

Stream logs:

```bash
az webapp log tail \
  --resource-group <RESOURCE_GROUP> \
  --name <FUNCTION_APP>
```

Application Insights query:

```kusto
requests
| where timestamp > ago(24h)
| summarize requests=count(), failures=countif(success == false),
            p95=percentile(duration, 95) by operation_Name
| order by failures desc
```

Exceptions:

```kusto
exceptions
| where timestamp > ago(24h)
| project timestamp, type, outerMessage, operation_Name
| order by timestamp desc
```

Do not add payload or credential fields to telemetry.

## Suggested alerts

- Availability test fails twice in ten minutes.
- HTTP 5xx count exceeds three in fifteen minutes.
- P95 duration exceeds ten seconds.
- GitHub returns 401 or 403.
- GitHub rate limit remaining drops below an agreed threshold.
- Daily timer has no successful invocation by the reporting deadline.
- Storage write fails.
- Key Vault reference resolution fails.

## Refresh schedule

The Functions timer uses `0 0 6 * * *` (06:00 UTC daily). Confirm GitHub's previous-day processing window before
production. Power BI refresh should start after ingestion and validation complete.

## Recovery

- Source outage: retain the previous `latest.json`, alert, and retry later.
- Invalid new payload: quarantine it; do not replace the last valid snapshot.
- Deleted latest file: restore from timestamped history.
- Compute failure: redeploy from the tagged repository revision.
- Key compromise: revoke the GitHub key, rotate Key Vault, and restart compute.

## Change procedure

1. Create a branch and PR.
2. Run backend tests, Bicep build, and shell syntax checks.
3. Review infrastructure changes and cost impact.
4. Deploy to a non-production RG.
5. Run smoke tests.
6. Promote the same immutable package.
7. Record deployed commit and configuration.

## Azure Policy

Policy behavior varies by tenant. If policies modify or deny Storage/Key Vault networking or local authentication,
adapt the architecture to the landing zone with managed identity, VNet integration, private endpoints, and private
DNS. Any exception must be explicitly approved, narrowly scoped, and time limited.
