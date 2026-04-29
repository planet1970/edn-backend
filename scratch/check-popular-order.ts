import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const popularPlaces = await prisma.popularPlaceAdvertisement.findMany({
    orderBy: { order: 'asc' },
  });
  console.log('Current Popular Places:');
  popularPlaces.forEach((p) => {
    console.log(`ID: ${p.id}, Title: ${p.title}, Order: ${p.order}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
