# Cost considerations

## Current demo

| Component | Charging model | Main driver |
| --- | --- | --- |
| Linux Consumption Functions | Consumption | Executions, duration, and memory |
| Application Insights / Log Analytics | Consumption | Ingested telemetry and retention |
| Storage Account | Consumption | Capacity, transactions, redundancy |
| Key Vault | Transactions | Secret operations |
| Data transfer | Consumption | Outbound traffic |

The Function executes once daily plus on manual refresh, so compute activity is small. Report size, Blob history, and
Application Insights retention are the principal variable drivers. Consult the Azure Pricing Calculator for the
subscription agreement and current regional price; this repository does not hard-code prices.

## Target Functions architecture

On a Consumption or Flex Consumption design, cost is driven by:

- Invocation count.
- Execution duration.
- Allocated memory.
- Always-ready instances, if configured.
- Host and metrics storage.
- Networking and private endpoints.
- Application Insights ingestion.

A single daily token exchange and metrics retrieval is normally negligible. Enterprise networking, monitoring, and
data retention can cost more than the function execution.

## Power BI

Power BI cost is separate from the Azure RG. It depends on:

- Per-user Pro/Premium Per User licensing.
- Fabric or Power BI capacity.
- Workspace and sharing requirements.
- Refresh frequency and model size.

## Cost controls

- Tag every resource.
- Use a dedicated RG.
- Keep Log Analytics retention intentional.
- Sample telemetry and exclude payload bodies.
- Schedule non-production compute shutdown where supported.
- Add a resource-group budget and alerts.
- Avoid unnecessary private endpoints in throwaway demos, while never weakening mandatory policy.
- Run `scripts/cleanup.sh` after the demonstration.

## Estimating production data cost

Measure for 24–72 hours:

1. Average and percentile payload sizes.
2. Calls and subcalls per collection.
3. Daily compressed and uncompressed volume.
4. Required history and retention.
5. Query and refresh frequency.
6. Logging volume.
7. Network path and egress.

Model 100%, 20%, 10%, and 5% retention/sampling scenarios where meaningful. User count alone is not a reliable cost
unit; volume and processing are.
