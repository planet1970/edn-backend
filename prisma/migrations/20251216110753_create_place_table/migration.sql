-- CreateTable
CREATE TABLE "Place" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "pic_url" TEXT,
    "icon1" TEXT,
    "title1" TEXT,
    "info1" TEXT,
    "icon2" TEXT,
    "title2" TEXT,
    "info2" TEXT,
    "icon3" TEXT,
    "title3" TEXT,
    "info3" TEXT,
    "icon4" TEXT,
    "title4" TEXT,
    "info4" TEXT,
    "description" TEXT,
    "rating" DOUBLE PRECISION,
    "panel1_title" TEXT,
    "panel1" TEXT,
    "panel2_title" TEXT,
    "panel2" TEXT,
    "panel_col_title" TEXT,
    "panel_col" TEXT,
    "panel3_title" TEXT,
    "panel3" TEXT,
    "panel4_title" TEXT,
    "panel4" TEXT,
    "panel_col_title2" TEXT,
    "panel_col2" TEXT,
    "panel5_title" TEXT,
    "area1" TEXT,
    "area2" TEXT,
    "area3" TEXT,
    "area4" TEXT,
    "area5" TEXT,
    "area6" TEXT,
    "area7" TEXT,
    "area8" TEXT,
    "area9" TEXT,
    "area10" TEXT,
    "source" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
