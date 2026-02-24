/*
  Warnings:

  - You are about to drop the column `iconName` on the `SubCategory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SubCategory" DROP COLUMN "iconName",
ADD COLUMN     "imageUrl" TEXT;
