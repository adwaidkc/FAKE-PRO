/*
  Warnings:

  - A unique constraint covering the columns `[productId,manufacturerId]` on the table `ProductSecret` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `manufacturerId` to the `ProductSecret` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ProductSecret_productId_key";

-- AlterTable
ALTER TABLE "ProductSecret" ADD COLUMN     "manufacturerId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ProductSecret_productId_manufacturerId_key" ON "ProductSecret"("productId", "manufacturerId");

-- AddForeignKey
ALTER TABLE "ProductSecret" ADD CONSTRAINT "ProductSecret_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
