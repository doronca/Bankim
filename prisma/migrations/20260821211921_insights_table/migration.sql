-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT,
    "ruleKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionText" TEXT,
    "amount" REAL,
    "metadata" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Insight_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Insight_entityId_idx" ON "Insight"("entityId");

-- CreateIndex
CREATE INDEX "Insight_type_idx" ON "Insight"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Insight_entityId_ruleKey_key" ON "Insight"("entityId", "ruleKey");
