-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "webIcon" TEXT;

-- CreateTable
CREATE TABLE "WebHeroSlide" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "titleColor" TEXT DEFAULT '#FFB627',
    "subtitleColor" TEXT DEFAULT '#FFFFFF',
    "descriptionColor" TEXT DEFAULT '#FFFFFF',
    "titleShadowColor" TEXT DEFAULT 'rgba(0,0,0,0.9)',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebHeroSlide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebSocialInfo" (
    "id" SERIAL NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "twitter" TEXT,
    "youtube" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebSocialInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebNavbar" (
    "id" SERIAL NOT NULL,
    "logoUrl" TEXT,
    "title" TEXT,
    "titleColor" TEXT DEFAULT '#333333',
    "fontFamily" TEXT DEFAULT 'Inter',
    "fontSize" INTEGER DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebNavbar_pkey" PRIMARY KEY ("id")
);
