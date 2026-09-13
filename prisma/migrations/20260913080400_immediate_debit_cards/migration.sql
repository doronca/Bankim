-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AccountMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "nickname" TEXT,
    "accountNumber" TEXT,
    "providerId" TEXT,
    "providerName" TEXT,
    "accountType" TEXT NOT NULL,
    "billingDayOverride" INTEGER,
    "isImmediateDebit" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "entityId" TEXT,
    "mergedIntoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccountMapping_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccountMapping_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "AccountMapping" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AccountMapping" ("accountNumber", "accountType", "billingDayOverride", "createdAt", "currency", "displayName", "entityId", "externalId", "id", "mergedIntoId", "nickname", "providerId", "providerName", "source", "updatedAt") SELECT "accountNumber", "accountType", "billingDayOverride", "createdAt", "currency", "displayName", "entityId", "externalId", "id", "mergedIntoId", "nickname", "providerId", "providerName", "source", "updatedAt" FROM "AccountMapping";
DROP TABLE "AccountMapping";
ALTER TABLE "new_AccountMapping" RENAME TO "AccountMapping";
CREATE INDEX "AccountMapping_entityId_idx" ON "AccountMapping"("entityId");
CREATE INDEX "AccountMapping_mergedIntoId_idx" ON "AccountMapping"("mergedIntoId");
CREATE UNIQUE INDEX "AccountMapping_source_externalId_key" ON "AccountMapping"("source", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
