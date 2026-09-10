# Architecture decision log

## D1 — Preserve the upstream dashboard

Keep the MIT-licensed PBIX assets, themes, layout, and visuals. The adapted PBIP maintains table, column, measure,
relationship, page, and visual identifiers.

## D2 — Authenticate outside Power BI

Power BI never receives the GitHub App private key, App JWT, installation token, or signed report URL. Azure Functions
owns authentication and ingestion.

## D3 — Use Enterprise report mode

The backend consumes the current report-index endpoint, follows signed download links, validates `day_totals`, and
stores normalized daily records. It never silently falls back to sample data.

## D4 — Protect data endpoints

`metrics` and `compatibilityMetrics` use Function authentication. Dedicated function-scoped keys prevent the Power BI
read credential from triggering collection.

## D5 — Keep native and compatibility contracts

`metrics` exposes the current schema for new reports. `compatibilityMetrics` maps current fields to the upstream legacy
contract so existing visuals can remain bound.

## D6 — Do not invent missing dimensions

When the aggregate report lacks an old IDE/language/model user dimension, the compatibility adapter uses zero,
`No data reported`, or an aggregate label. It does not infer user counts.

## D7 — Store immutable history

Each collection writes `latest.json` and a timestamped history object. This supports Power BI refresh, audit, replay,
and recovery.

## D8 — Keep environment configuration out of Git

Public templates contain placeholders. Actual `.bicepparam` files, private keys, Function keys, resource names, IDs,
and URLs are local or managed by Azure.

## D9 — Treat KPI values as scenarios

Developer count, salary, work weeks, and assumed time savings are customer inputs, not measured facts. The KPI page
must be reviewed before presentation.
