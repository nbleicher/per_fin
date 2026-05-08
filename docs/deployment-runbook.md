# Deployment and Rollback Runbook

## Pre-Deploy
1. Ensure staging checklist is fully completed.
2. Run:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
3. Apply Prisma migration in target environment.
4. Verify environment variables (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` for Turso; local Prisma uses `file:` URL in schema).

### Turso migrations (production)

Prisma’s datasource URL in [`prisma/schema.prisma`](/Users/noahbleicher/Documents/projects/personal_fin/prisma/schema.prisma) must remain `file:` for `prisma migrate` tooling; **`prisma migrate deploy` on a host only applies migrations to that SQLite file**, not to your remote Turso cluster.

Apply pending SQL to Turso after generating migrations locally (see [Turso + Prisma](https://docs.turso.tech/sdk/ts/orm/prisma)), e.g. pipe each `prisma/migrations/<name>/migration.sql` into `turso db shell`, or use Turso’s recommended CI workflow—do not rely on Railway pre-deploy `migrate deploy` alone to update Turso unless you intentionally migrate an ephemeral local file (usually wrong for this app).

## Deploy
1. Deploy application artifact.
2. Run health checks on:
   - `/dashboard`
   - `/finance`
   - `/api/dashboard/summary`
   - `/api/settings/export`
3. Validate a quick transaction create/delete cycle in production-safe test account.

## Post-Deploy Smoke
1. Verify finance tab navigation and data loading.
2. Verify dashboard metrics render and non-zero seeded/test data appears.
3. Verify settings export endpoint returns payload.

## Rollback Plan
1. Roll back app artifact to previous stable build.
2. If migration introduced incompatible schema changes, restore DB from backup snapshot.
3. Re-run smoke checks on rolled-back version.
4. Record incident details and migration delta that triggered rollback.
