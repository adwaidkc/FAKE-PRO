/*
  Warnings:

  - Added the required column `boxId` to the `ProductSecret` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductSecret" ADD COLUMN     "boxId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Box" (
    "id" SERIAL NOT NULL,
    "boxId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Box_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Box_boxId_key" ON "Box"("boxId");

-- AddForeignKey
ALTER TABLE "ProductSecret" ADD CONSTRAINT "ProductSecret_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("boxId") ON DELETE RESTRICT ON UPDATE CASCADE;
