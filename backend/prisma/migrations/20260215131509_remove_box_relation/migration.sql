/*
  Warnings:

  - You are about to drop the column `boxId` on the `ProductSecret` table. All the data in the column will be lost.
  - You are about to drop the `Box` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductSecret" DROP CONSTRAINT "ProductSecret_boxId_fkey";

-- AlterTable
ALTER TABLE "ProductSecret" DROP COLUMN "boxId";

-- DropTable
DROP TABLE "Box";
