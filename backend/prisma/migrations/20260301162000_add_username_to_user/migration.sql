ALTER TABLE "User"
ADD COLUMN "username" TEXT;

CREATE INDEX "User_username_idx" ON "User"("username");
