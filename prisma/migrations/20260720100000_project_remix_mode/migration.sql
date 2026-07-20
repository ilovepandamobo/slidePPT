-- AlterTable
ALTER TABLE "Project" ADD COLUMN "generationMode" TEXT NOT NULL DEFAULT 'outline';

-- AlterTable
ALTER TABLE "Slide" ADD COLUMN "layoutReference" TEXT;
