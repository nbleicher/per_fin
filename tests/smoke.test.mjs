import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

test("phase 1 route files exist", () => {
  const requiredFiles = [
    "app/layout.tsx",
    "app/page.css",
    "app/dashboard/page.tsx",
    "app/dashboard/page.module.css",
    "app/finance/page.tsx",
    "app/finance/page.module.css",
    "app/transactions/page.tsx",
    "app/transactions/page.module.css",
    "app/accounts/page.tsx",
    "app/accounts/page.module.css",
    "app/strategy/page.tsx",
    "app/strategy/page.module.css",
    "app/settings/page.tsx",
    "app/settings/page.module.css",
  ];

  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `Expected ${file} to exist`);
  }
});

test("phase 2 schema and api files exist", () => {
  const requiredFiles = [
    "prisma/schema.prisma",
    "prisma/seed.ts",
    "lib/db/prisma.ts",
    "lib/api/contracts.ts",
    "lib/validation/schemas.ts",
    "app/api/accounts/route.ts",
    "app/api/accounts/[id]/route.ts",
    "app/api/transactions/route.ts",
    "app/api/transactions/[id]/route.ts",
    "app/api/bills/route.ts",
    "app/api/bills/[id]/route.ts",
    "app/api/portfolios/route.ts",
    "app/api/holdings/route.ts",
    "app/api/trades/route.ts",
    "app/api/dividends/route.ts",
    "app/api/snapshots/route.ts",
    "app/api/fire-settings/route.ts",
    "app/api/fire-settings/projection/route.ts",
    "app/api/strategy-items/route.ts",
    "app/api/strategy-items/[id]/route.ts",
    "app/api/dashboard/summary/route.ts",
    "app/api/settings/export/route.ts",
    "app/api/settings/import/route.ts",
    "docs/api-contracts.md",
    "docs/staging-acceptance-checklist.md",
    "docs/deployment-runbook.md",
  ];

  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `Expected ${file} to exist`);
  }
});
