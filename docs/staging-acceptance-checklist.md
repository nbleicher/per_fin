# Staging Acceptance Checklist

## Core Navigation
- App shell loads with routes: `/dashboard`, `/finance`, `/transactions`, `/accounts`, `/strategy`, `/settings`.
- Each page has its own CSS file/module and renders without style import errors.

## Data and APIs
- Prisma migration applies cleanly.
- Seed command runs successfully and creates baseline data.
- CRUD APIs for accounts, transactions, bills, portfolios, holdings, trades, dividends, categories, snapshots, and strategy items respond with contract envelope.

## Finance Workflows
- `Finance > Bills`: mark paid and undo update transaction ledger correctly.
- `Finance > Budget`: percent allocations validate and post atomically.
- `Finance > Credit` and `Finance > Debit`: balances and APR display from account/txn data.
- `Finance > Investments`: portfolio lifecycle and metrics function.
- `Finance > FIRE`: assumptions save and projection recomputes consistently.

## Dashboard and Strategy
- Dashboard totals reconcile to account/transaction aggregates.
- Strategy CRUD works and does not mutate transactional entities.

## Settings and Data Tools
- Export API downloads JSON backup with expected keys.
- XLSX import API ingests valid rows and deduplicates existing records.

## Quality Gates
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm test` passes.
- `npm run build` passes.
