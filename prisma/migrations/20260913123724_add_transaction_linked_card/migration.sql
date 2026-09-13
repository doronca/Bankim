-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountMappingId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "postedDate" DATETIME,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "description" TEXT NOT NULL,
    "additionalInfo" TEXT,
    "merchantNormalized" TEXT,
    "category" TEXT,
    "note" TEXT,
    "paymentMethod" TEXT,
    "isRecurringCandidate" BOOLEAN NOT NULL DEFAULT false,
    "isInvoiced" BOOLEAN,
    "sourceRef" TEXT,
    "autoRuleId" TEXT,
    "linkedCardId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_accountMappingId_fkey" FOREIGN KEY ("accountMappingId") REFERENCES "AccountMapping" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_autoRuleId_fkey" FOREIGN KEY ("autoRuleId") REFERENCES "AutoRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_linkedCardId_fkey" FOREIGN KEY ("linkedCardId") REFERENCES "AccountMapping" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("accountMappingId", "additionalInfo", "amount", "autoRuleId", "category", "createdAt", "currency", "date", "description", "id", "isInvoiced", "isRecurringCandidate", "merchantNormalized", "note", "paymentMethod", "postedDate", "sourceRef", "updatedAt") SELECT "accountMappingId", "additionalInfo", "amount", "autoRuleId", "category", "createdAt", "currency", "date", "description", "id", "isInvoiced", "isRecurringCandidate", "merchantNormalized", "note", "paymentMethod", "postedDate", "sourceRef", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
CREATE INDEX "Transaction_category_idx" ON "Transaction"("category");
CREATE UNIQUE INDEX "Transaction_accountMappingId_sourceRef_key" ON "Transaction"("accountMappingId", "sourceRef");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
