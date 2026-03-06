
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const scheduledAds = await prisma.webPopupAd.findMany();
    const defaultAd = await prisma.webDefaultPopup.findFirst();

    console.log('--- Scheduled Ads ---');
    console.table(scheduledAds.map(a => ({
        id: a.id,
        title: a.title,
        isActive: a.isActive,
        start: a.startDate,
        end: a.endDate
    })));

    console.log('--- Default Ad ---');
    console.log(defaultAd);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
