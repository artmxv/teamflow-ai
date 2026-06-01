-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "industry" TEXT,
ADD COLUMN     "teamSize" TEXT;
