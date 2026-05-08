-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FireSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "currentAge" INTEGER NOT NULL DEFAULT 30,
    "projectedAnnualIncome" REAL NOT NULL DEFAULT 120000,
    "annualSpending" REAL NOT NULL DEFAULT 60000,
    "expectedReturnPct" REAL NOT NULL DEFAULT 7,
    "inflationPct" REAL NOT NULL DEFAULT 2.5,
    "swrPct" REAL NOT NULL DEFAULT 4,
    "contributionOverride" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FireSettings" ("annualSpending", "contributionOverride", "createdAt", "currentAge", "expectedReturnPct", "id", "inflationPct", "swrPct", "updatedAt") SELECT "annualSpending", "contributionOverride", "createdAt", "currentAge", "expectedReturnPct", "id", "inflationPct", "swrPct", "updatedAt" FROM "FireSettings";
DROP TABLE "FireSettings";
ALTER TABLE "new_FireSettings" RENAME TO "FireSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
