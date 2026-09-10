# Troubleshooting

## Health endpoint times out or returns 503

Check:

```bash
az functionapp show -g <RESOURCE_GROUP> \
  -n <FUNCTION_APP> \
  --query '{state:state,availabilityState:availabilityState}'

az webapp log tail -g <RESOURCE_GROUP> \
  -n <FUNCTION_APP>
```

Confirm the Function runtime is `Node|22`, host Storage is reachable, and the package setting was created by Functions
Core Tools. Do not hard-code `WEBSITE_RUN_FROM_PACKAGE` in Bicep.

## Function deployment reports invalid `AzureWebJobsStorage`

If the CLI reports:

```text
Error creating a Blob container reference.
KeyBasedAuthenticationNotPermitted
```

inspect:

```bash
az storage account show -g <RESOURCE_GROUP> \
  -n <storage-name> \
  --query '{allowSharedKeyAccess:allowSharedKeyAccess,publicNetworkAccess:publicNetworkAccess}'
```

If organizational policy disables shared keys or public endpoints, use identity-based host Storage, VNet integration,
private endpoints, and private DNS. Do not copy exemptions from another tenant; involve the cloud-governance owner.

## Trigger synchronization returns HTTP 400

- Run `func start` locally and confirm all four triggers index.
- Use Node 22 on Linux Consumption; Node 24 trigger synchronization failed in this environment.
- Let Functions Core Tools manage `WEBSITE_RUN_FROM_PACKAGE`.
- Confirm the Storage exemption is active before publishing.

## Metrics endpoint returns 403

`PUBLIC_METRICS_ENABLED` is false. This is required for production. Read protected persisted data through the approved
Power BI identity instead of reopening the endpoint.

## Metrics endpoint returns 500

Check:

- `DATA_SOURCE_MODE` is `sample`, `github-app`, or `enterprise-report`.
- Production settings are all present.
- The Key Vault reference resolved.
- The private key is PKCS#8-compatible for RS256.
- The GitHub URL returns a JSON array compatible with this version.
- The report-index response contains HTTPS `download_links`.
- The downloaded Enterprise report contains a non-empty `day_totals` array.

## GitHub returns 401

- Verify app/client ID and installation ID.
- Verify Azure and GitHub clocks.
- JWT expiration must be no more than ten minutes.
- Ensure the private key belongs to the app.
- Ensure JWT authorization uses `Bearer`.

## GitHub returns 403

- Enable the Copilot metrics policy.
- Check the GitHub App permission.
- Check enterprise/organization role requirements.
- Confirm the app is installed at the requested scope.
- Review rate-limit headers.

## Power BI is empty

- Open the `source` query and inspect the raw list.
- Confirm the endpoint returns an array.
- Clear and recreate web-source credentials.
- Confirm query transformations match the selected API schema.
- Refresh `source` before dependent queries.

## Power BI Service refresh fails but Desktop works

- Reconfigure credentials in the semantic model.
- Confirm the URL is not constructed dynamically in a way the service rejects.
- Confirm the source is publicly reachable or accessible through the selected gateway.
- For production, use a supported Entra-authenticated storage/database source.

## Power BI API returns 404 for `/groups`

Confirm:

- The user has a Power BI/Fabric license.
- Power BI is provisioned for the tenant.
- The token targets `https://analysis.windows.net/powerbi/api`.
- The identity can access at least one workspace.
- Tenant and account are the intended ones.

The current deployment received this 404 and therefore did not publish the PBIX.
