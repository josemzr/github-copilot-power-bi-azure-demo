# Cleanup

## Delete the Azure demo

The cleanup script deletes only the explicitly named resource group and requires its name twice:

```bash
./scripts/cleanup.sh \
  --resource-group <RESOURCE_GROUP> \
  --confirm <RESOURCE_GROUP>
```

Deletion is asynchronous. Monitor it:

```bash
az group wait \
  --name <RESOURCE_GROUP> \
  --deleted
```

The script deliberately does not use wildcards, subscription-wide deletion, or name-prefix matching.
Any external Policy exemption must be removed separately if it was created outside the resource-group scope.

## Key Vault behavior

Key Vault purge protection is enabled. Resource-group deletion removes the active vault but Azure retains the deleted
vault for the configured recovery period. This is intentional. Do not purge it merely to reuse the name unless the
organization's recovery policy explicitly permits that action.

## Power BI cleanup

Azure RG deletion does not remove:

- Power BI reports.
- Semantic models.
- Workspaces.
- Data-source credentials.
- Refresh schedules.

Delete or archive these separately in Power BI Service.

## GitHub cleanup

If a GitHub App was created:

1. Disable scheduled ingestion.
2. Uninstall or suspend the app.
3. Revoke/delete its private keys.
4. Remove the Key Vault secret after the retention decision.
5. Archive or delete the GitHub repository only after preserving required evidence.
