-- AlterTable
ALTER TABLE "Bid" ADD COLUMN "followUpOn" DATETIME;

-- CreateIndex
CREATE INDEX "Bid_followUpOn_idx" ON "Bid"("followUpOn");
