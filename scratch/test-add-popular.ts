import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const newItem = await prisma.popularPlaceAdvertisement.create({
    data: {
      title: "Test Place",
      description: "Test Description",
      imageUrl: "test.png",
      link: "/test",
      order: 0,
      isActive: true,
      rating: 0,
      visitCount: 0,
    },
  });
  console.log('Created new item:', newItem);

  const all = await prisma.popularPlaceAdvertisement.findMany({
    orderBy: { order: 'asc' },
  });
  console.log('All items after creation:');
  all.forEach((p) => {
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
