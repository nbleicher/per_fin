# Phase 2 API Contracts

## Response Envelope

All API routes return one of:

- Success
  - `{ "ok": true, "data": <payload>, "meta"?: { ... } }`
- Error
  - `{ "ok": false, "error": { "code": string, "message": string, "details"?: unknown } }`

## Pagination Convention

List routes support:

- `page` (default `1`)
- `pageSize` (default `25`, max `100`)

List responses include:

- `meta.page`
- `meta.pageSize`
- `meta.total`
- `meta.totalPages`

## Core Routes

- `GET /api/accounts`
- `POST /api/accounts`
- `GET /api/accounts/:id`
- `PATCH /api/accounts/:id`
- `DELETE /api/accounts/:id`

- `GET /api/transactions`
- `POST /api/transactions`
- `GET /api/transactions/:id`
- `PATCH /api/transactions/:id`
- `DELETE /api/transactions/:id`

- `GET /api/bills`
- `POST /api/bills`
- `GET /api/bills/:id`
- `PATCH /api/bills/:id`
- `DELETE /api/bills/:id`

## Planning/Workspace Routes (Scaffolds)

- `GET|POST /api/portfolios`
- `GET|POST /api/holdings`
- `GET|POST /api/trades`
- `GET|POST /api/dividends`
- `GET|POST /api/snapshots`
- `GET|PUT /api/fire-settings`
- `GET|POST /api/strategy-items`
- `GET|PATCH|DELETE /api/strategy-items/:id`
- `POST /api/fire-settings/projection`
- `GET /api/dashboard/summary`
- `GET /api/settings/export`
- `POST /api/settings/import`

## Validation

`zod` schemas are centralized in `lib/validation/schemas.ts`.

## Notes

- `loan` remains internal taxonomy value (`AccountSubtype.LOAN`); UI can render label `debit`.
- Current project is single-tenant local scope; multi-user ownership can be added later without changing route shapes.
