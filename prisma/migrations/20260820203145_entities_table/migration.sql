-- Converts the fixed 4-value Entity enum into a real, user-editable table.
-- Existing enum values ("parents"/"brother"/"personal"/"company") become the
-- ids of seeded Entity rows, so every existing AccountMapping/AutoRule
-- assignment keeps pointing at the same value and needs no data rewrite.

PRAGMA foreign_keys=OFF;

CREATE TABLE "Entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "Entity" ("id", "name", "icon", "order", "updatedAt") VALUES
    ('parents', 'Parents', '👪', 0, CURRENT_TIMESTAMP),
    ('brother', 'Brother', '🧑', 1, CURRENT_TIMESTAMP),
    ('personal', 'Personal', '👤', 2, CURRENT_TIMESTAMP),
    ('company', 'Company', '🏢', 3, CURRENT_TIMESTAMP);

-- AccountMapping: rebuild with entityId FK (SQLite can't ALTER a column into
-- a FK in place).
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
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "entityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "new_AccountMapping_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_AccountMapping" ("id","source","externalId","displayName","nickname","accountNumber","providerId","providerName","accountType","currency","entityId","createdAt","updatedAt")
SELECT "id","source","externalId","displayName","nickname","accountNumber","providerId","providerName","accountType","currency","entity","createdAt","updatedAt" FROM "AccountMapping";

DROP TABLE "AccountMapping";
ALTER TABLE "new_AccountMapping" RENAME TO "AccountMapping";

CREATE UNIQUE INDEX "AccountMapping_source_externalId_key" ON "AccountMapping"("source", "externalId");
CREATE INDEX "AccountMapping_entityId_idx" ON "AccountMapping"("entityId");

-- AutoRule: same rebuild.
CREATE TABLE "new_AutoRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchType" TEXT NOT NULL DEFAULT 'contains',
    "pattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "entityId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "new_AutoRule_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_AutoRule" ("id","matchType","pattern","category","entityId","priority","createdAt","updatedAt")
SELECT "id","matchType","pattern","category","entity","priority","createdAt","updatedAt" FROM "AutoRule";

DROP TABLE "AutoRule";
ALTER TABLE "new_AutoRule" RENAME TO "AutoRule";

CREATE INDEX "AutoRule_pattern_idx" ON "AutoRule"("pattern");

PRAGMA foreign_keys=ON;
