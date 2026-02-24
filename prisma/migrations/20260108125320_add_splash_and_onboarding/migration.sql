/*
  Warnings:

  - You are about to drop the column `story` on the `FoodPlace` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FoodPlace" DROP COLUMN "story",
ADD COLUMN     "backContent" TEXT,
ADD COLUMN     "frontContent" TEXT;

-- CreateTable
CREATE TABLE "SplashScreen" (
    "id" SERIAL NOT NULL,
    "backgroundColor" TEXT,
    "logoUrl" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 3000,
    "tagline" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplashScreen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingScreen" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingScreen_pkey" PRIMARY KEY ("id")
);
