-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hashingAlgorithm" TEXT NOT NULL DEFAULT 'argon2';
