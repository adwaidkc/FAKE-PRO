/*
  Warnings:

  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `ProductSecret` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[manufacturerId,boxId]` on the table `Box` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Box` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANUFACTURER', 'RETAILER', 'USER');

-- CreateEnum
CREATE TYPE "ProductLifecycleStatus" AS ENUM ('CREATED', 'SHIPPED', 'VERIFIED', 'SOLD');

-- DropForeignKey
ALTER TABLE "ProductSecret" DROP CONSTRAINT "ProductSecret_manufacturerId_fkey";

-- DropIndex
DROP INDEX "Box_boxId_manufacturerId_key";

-- AlterTable
ALTER TABLE "Box" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "ProductSecret";

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "manufacturerId" INTEGER NOT NULL,
    "boxId" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL,
    "nfcSecret" TEXT NOT NULL,
    "lifecycle" "ProductLifecycleStatus" NOT NULL DEFAULT 'CREATED',
    "shipped" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "sold" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_productId_idx" ON "Product"("productId");

-- CreateIndex
CREATE INDEX "Product_manufacturerId_boxId_idx" ON "Product"("manufacturerId", "boxId");

-- CreateIndex
CREATE INDEX "Product_manufacturerId_batchId_idx" ON "Product"("manufacturerId", "batchId");

-- CreateIndex
CREATE INDEX "Product_manufacturerId_lifecycle_idx" ON "Product"("manufacturerId", "lifecycle");

-- CreateIndex
CREATE INDEX "Product_manufacturerId_shipped_verified_sold_idx" ON "Product"("manufacturerId", "shipped", "verified", "sold");

-- CreateIndex
CREATE UNIQUE INDEX "Product_manufacturerId_productId_key" ON "Product"("manufacturerId", "productId");

-- CreateIndex
CREATE INDEX "Box_manufacturerId_batchId_idx" ON "Box"("manufacturerId", "batchId");

-- CreateIndex
CREATE INDEX "Box_boxId_idx" ON "Box"("boxId");

-- CreateIndex
CREATE INDEX "Box_batchId_idx" ON "Box"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Box_manufacturerId_boxId_key" ON "Box"("manufacturerId", "boxId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
