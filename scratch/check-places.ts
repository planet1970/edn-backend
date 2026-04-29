
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const places = await prisma.place.findMany({
    select: {
      id: true,
      title: true,
      pic_url: true,
    },
    take: 10,
  });
  console.log(JSON.stringify(places, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
