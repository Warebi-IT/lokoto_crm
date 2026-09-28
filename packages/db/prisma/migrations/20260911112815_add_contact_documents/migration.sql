-- CreateEnum
CREATE TYPE "ContactDocumentType" AS ENUM ('DRIVERS_LICENSE', 'ID_CARD', 'PROOF_OF_ADDRESS', 'OTHER');

-- CreateTable
CREATE TABLE "contactDocument" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" "ContactDocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "contentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contactDocument_contactId_idx" ON "contactDocument"("contactId");

-- AddForeignKey
ALTER TABLE "contactDocument" ADD CONSTRAINT "contactDocument_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
