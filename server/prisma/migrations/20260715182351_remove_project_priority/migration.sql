/*
  Warnings:

  - You are about to drop the column `priority` on the `projects` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_UNASSIGNED';

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_projectId_fkey";

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "priority",
ADD COLUMN     "rawFootageLink" TEXT,
ADD COLUMN     "scriptLink" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT;

-- DropEnum
DROP TYPE "ProjectPriority";

-- CreateTable
CREATE TABLE "editor_assignment_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "previousEditorId" TEXT,
    "newEditorId" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_assignment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InvoiceProjects" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InvoiceProjects_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "editor_assignment_logs_projectId_idx" ON "editor_assignment_logs"("projectId");

-- CreateIndex
CREATE INDEX "editor_assignment_logs_changedById_idx" ON "editor_assignment_logs"("changedById");

-- CreateIndex
CREATE INDEX "_InvoiceProjects_B_index" ON "_InvoiceProjects"("B");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InvoiceProjects" ADD CONSTRAINT "_InvoiceProjects_A_fkey" FOREIGN KEY ("A") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InvoiceProjects" ADD CONSTRAINT "_InvoiceProjects_B_fkey" FOREIGN KEY ("B") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
