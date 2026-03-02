-- Add retailer columns to Box
ALTER TABLE "Box"
  ADD COLUMN "retailerEmail" TEXT;

ALTER TABLE "Box"
  ADD COLUMN "retailerId" INTEGER;

ALTER TABLE "Box"
  ADD CONSTRAINT "Box_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
