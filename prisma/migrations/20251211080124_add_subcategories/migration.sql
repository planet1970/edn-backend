/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `SubCategory` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `SubCategory` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `SubCategory` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SubCategory" DROP CONSTRAINT "SubCategory_parentId_fkey";

-- AlterTable
ALTER TABLE "SubCategory" DROP COLUMN "imageUrl",
DROP COLUMN "parentId",
ADD COLUMN     "categoryId" INTEGER NOT NULL,
ADD COLUMN     "iconName" TEXT;

-- AddForeignKey
ALTER TABLE "SubCategory" ADD CONSTRAINT "SubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
