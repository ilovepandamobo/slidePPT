-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "stylePrompt" TEXT,
    "styleReference" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "imageQuality" TEXT NOT NULL DEFAULT 'standard',
    "audience" TEXT,
    "scene" TEXT,
    "outlineRaw" TEXT,
    "styleToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "watermark" BOOLEAN NOT NULL DEFAULT true,
    "shareToken" TEXT,
    "sharePassword" TEXT,
    "shareExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("aspectRatio", "audience", "createdAt", "id", "outlineRaw", "scene", "shareExpiresAt", "sharePassword", "shareToken", "status", "stylePrompt", "styleReference", "styleToken", "templateId", "title", "updatedAt", "userId", "watermark") SELECT "aspectRatio", "audience", "createdAt", "id", "outlineRaw", "scene", "shareExpiresAt", "sharePassword", "shareToken", "status", "stylePrompt", "styleReference", "styleToken", "templateId", "title", "updatedAt", "userId", "watermark" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_shareToken_key" ON "Project"("shareToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
