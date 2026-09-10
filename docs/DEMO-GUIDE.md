# Ten-minute demonstration guide

## Preflight

Complete these checks before the meeting:

```bash
curl --fail \
  https://<FUNCTION_APP>.azurewebsites.net/api/health

KEY="$(az functionapp function keys list \
  --resource-group <RESOURCE_GROUP> \
  --name <FUNCTION_APP> \
  --function-name metrics \
  --query '["power-bi-read"]' -o tsv)"

curl --fail \
  --header "x-functions-key: $KEY" \
  https://<FUNCTION_APP>.azurewebsites.net/api/metrics |
  jq 'length'
```

Expected result: health is `healthy`, mode is `enterprise-report`, and the array contains 28 records.

Open these items in advance:

1. The repository README.
2. `docs/ARCHITECTURE.md`.
3. The deployment's Azure resource group.
4. The health and metrics endpoints.
5. The PBIX in Power BI Desktop, if a Windows machine is available.
6. `assets/Sample_Metrics_PBI.png` as a guaranteed visual fallback.

## Talk track

### Minute 0–1: customer problem

"GitHub exposes Copilot adoption and engagement metrics, but Power BI should not be responsible for generating
GitHub App JWTs, rotating one-hour installation tokens, or holding a private key."

### Minute 1–3: dashboard

Show `assets/Sample_Metrics_PBI.png` or the PBIX. Explain:

- Active versus engaged users.
- IDE chat, code completion, GitHub.com chat, and pull-request metrics.
- Editor and language slicing.
- KPI assumptions such as developer count, hourly cost, work weeks, and estimated weekly time saved.

State clearly that ROI fields are hypotheses until validated with customer data and developer surveys.

### Minute 3–5: live Azure source

Open `/api/health`, then `/api/metrics`. Explain that:

- The endpoint is live in Azure.
- The current payload is real Enterprise aggregate data and requires a dedicated Function key.
- Power BI consumes ordinary JSON.
- No GitHub token appears in the PBIX.

### Minute 5–7: secure production flow

Show the production sequence diagram. Explain:

1. A timer invokes the collector daily.
2. Managed identity resolves the GitHub App private key from Key Vault.
3. The collector signs a JWT valid for at most 10 minutes.
4. GitHub exchanges it for a one-hour installation token.
5. The collector retrieves Copilot metrics and writes a curated snapshot.
6. Power BI reads the stored data rather than receiving the token.

### Minute 7–8: Azure controls

Show the resource group:

- Azure Function App, Timer Trigger, and managed identity.
- Key Vault with RBAC and purge protection.
- Storage with public access and key authentication disabled by policy.
- Application Insights and Log Analytics.

Explain the policy-driven fallback documented in `docs/DECISIONS.md`.

### Minute 8–9: operations and cost

Emphasize:

- Daily execution makes compute small in the target Functions design.
- Data volume and telemetry retention normally dominate variable cost.
- Application Insights sampling and retention must be intentional.
- Consumption Functions charge primarily for executions and duration; monitoring and data retention remain separate.

### Minute 9–10: next steps

Customer-specific inputs are:

- Enterprise or organization slug.
- GitHub App and installation.
- Exact metrics/report endpoint.
- Data classification and retention.
- Azure network landing-zone requirements.
- Power BI workspace, licensing, refresh identity, and ownership.

## Questions to expect

| Question | Answer |
| --- | --- |
| Why not put the token in Power BI? | It exposes a renewable credential and makes rotation, audit, and error handling difficult. |
| Why is the metrics endpoint protected? | It contains real Enterprise data; Power BI stores a dedicated function key as a Web API credential. |
| What if Azure Policy blocks deployment? | Follow the owning landing-zone design; use private networking or an explicitly approved, scoped, time-limited exception. |
| Does OpenTelemetry belong in this Function? | No. Continuous OTLP collection, batching, retries, and backpressure fit a collector on Container Apps or Kubernetes. |
| Can the PBIX be published automatically? | Yes, with a Power BI workspace and service principal permissions. This tenant currently exposes no workspace. |
| Is the KPI savings number authoritative? | No. It is configurable and must be validated with customer evidence. |

## Fallback plan

If Azure is unavailable:

1. Show the architecture diagram.
2. Open the PBIX against the local sample JSON.
3. Show the dashboard screenshots in `assets/`.
4. Run `npm test` to demonstrate validation of the data contract.
