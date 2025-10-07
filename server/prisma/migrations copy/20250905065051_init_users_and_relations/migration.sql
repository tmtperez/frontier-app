-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bid" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectName" TEXT NOT NULL,
    "clientCompanyId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "ownerId" INTEGER,
    "proposalDate" DATETIME,
    "dueDate" DATETIME,
    "jobLocation" TEXT,
    "leadSource" TEXT,
    "bidStatus" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bid_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bid_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bid_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bid" ("archived", "bidStatus", "clientCompanyId", "contactId", "createdAt", "dueDate", "id", "jobLocation", "leadSource", "projectName", "proposalDate", "updatedAt") SELECT "archived", "bidStatus", "clientCompanyId", "contactId", "createdAt", "dueDate", "id", "jobLocation", "leadSource", "projectName", "proposalDate", "updatedAt" FROM "Bid";
DROP TABLE "Bid";
ALTER TABLE "new_Bid" RENAME TO "Bid";
CREATE INDEX "Bid_clientCompanyId_idx" ON "Bid"("clientCompanyId");
CREATE INDEX "Bid_contactId_idx" ON "Bid"("contactId");
CREATE INDEX "Bid_ownerId_idx" ON "Bid"("ownerId");
CREATE INDEX "Bid_bidStatus_idx" ON "Bid"("bidStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Attachment_bidId_idx" ON "Attachment"("bidId");

-- CreateIndex
CREATE INDEX "BidTag_tagId_idx" ON "BidTag"("tagId");

-- CreateIndex
CREATE INDEX "Note_bidId_idx" ON "Note"("bidId");

-- CreateIndex
CREATE INDEX "Scope_bidId_idx" ON "Scope"("bidId");

-- CreateIndex
CREATE INDEX "Scope_status_idx" ON "Scope"("status");
