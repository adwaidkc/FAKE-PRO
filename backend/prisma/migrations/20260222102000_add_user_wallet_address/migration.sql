-- Add wallet binding for manufacturer accounts
ALTER TABLE "User" ADD COLUMN "walletAddress" TEXT;

CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");
