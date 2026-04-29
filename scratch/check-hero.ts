
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const slides = await prisma.webHeroSlide.findMany();
  console.log(JSON.stringify(slides, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
