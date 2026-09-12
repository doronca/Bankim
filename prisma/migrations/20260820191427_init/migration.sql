-- CreateTable
CREATE TABLE "AccountMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "entity" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountMappingId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "postedDate" DATETIME,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "description" TEXT NOT NULL,
    "merchantNormalized" TEXT,
    "category" TEXT,
    "paymentMethod" TEXT,
    "isRecurringCandidate" BOOLEAN NOT NULL DEFAULT false,
    "sourceRef" TEXT,
    "autoRuleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_accountMappingId_fkey" FOREIGN KEY ("accountMappingId") REFERENCES "AccountMapping" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_autoRuleId_fkey" FOREIGN KEY ("autoRuleId") REFERENCES "AutoRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutoRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchType" TEXT NOT NULL DEFAULT 'contains',
    "pattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "entity" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IbkrPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountMappingId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT,
    "assetCategory" TEXT,
    "quantity" REAL NOT NULL,
    "markPrice" REAL NOT NULL,
    "positionValue" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "asOfDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IbkrPosition_accountMappingId_fkey" FOREIGN KEY ("accountMappingId") REFERENCES "AccountMapping" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IbkrTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountMappingId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "tradeDate" DATETIME NOT NULL,
    "quantity" REAL NOT NULL,
    "price" REAL NOT NULL,
    "proceeds" REAL NOT NULL,
    "commission" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "buySell" TEXT NOT NULL,
    "sourceTradeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IbkrTrade_accountMappingId_fkey" FOREIGN KEY ("accountMappingId") REFERENCES "AccountMapping" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IbkrCashLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountMappingId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "endingCash" REAL NOT NULL,
    "asOfDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IbkrCashLine_accountMappingId_fkey" FOREIGN KEY ("accountMappingId") REFERENCES "AccountMapping" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountMappingId" TEXT NOT NULL,
    "asOfDate" DATETIME NOT NULL,
    "totalValue" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "sourceFile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioSnapshot_accountMappingId_fkey" FOREIGN KEY ("accountMappingId") REFERENCES "AccountMapping" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "lastSyncedAt" DATETIME,
    "cursor" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AccountMapping_entity_idx" ON "AccountMapping"("entity");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMapping_source_externalId_key" ON "AccountMapping"("source", "externalId");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_category_idx" ON "Transaction"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_accountMappingId_sourceRef_key" ON "Transaction"("accountMappingId", "sourceRef");

-- CreateIndex
CREATE INDEX "AutoRule_pattern_idx" ON "AutoRule"("pattern");

-- CreateIndex
CREATE INDEX "IbkrPosition_accountMappingId_asOfDate_idx" ON "IbkrPosition"("accountMappingId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "IbkrTrade_accountMappingId_sourceTradeId_key" ON "IbkrTrade"("accountMappingId", "sourceTradeId");

-- CreateIndex
CREATE INDEX "IbkrCashLine_accountMappingId_asOfDate_idx" ON "IbkrCashLine"("accountMappingId", "asOfDate");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_accountMappingId_asOfDate_idx" ON "PortfolioSnapshot"("accountMappingId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_source_key" ON "SyncState"("source");
