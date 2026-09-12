-- AlterTable
ALTER TABLE "AccountMapping" ADD COLUMN "accountNumber" TEXT;
ALTER TABLE "AccountMapping" ADD COLUMN "nickname" TEXT;
ALTER TABLE "AccountMapping" ADD COLUMN "providerId" TEXT;
ALTER TABLE "AccountMapping" ADD COLUMN "providerName" TEXT;

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);
