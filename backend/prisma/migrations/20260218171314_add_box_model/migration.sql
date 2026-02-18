-- CreateTable
CREATE TABLE "Box" (
    "id" SERIAL NOT NULL,
    "boxId" TEXT NOT NULL,
    "manufacturerId" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Box_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Box_boxId_manufacturerId_key" ON "Box"("boxId", "manufacturerId");

-- AddForeignKey
ALTER TABLE "Box" ADD CONSTRAINT "Box_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
