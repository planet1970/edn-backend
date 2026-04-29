import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Place ---');
  const places = await (prisma as any).$queryRaw`SELECT id, pic_url, back_pic_url FROM "Place" LIMIT 5`;
  console.log(JSON.stringify(places, null, 2));

  console.log('--- WebHeroSlide ---');
  const heroes = await (prisma as any).$queryRaw`SELECT id, "imageUrl" FROM "WebHeroSlide" LIMIT 5`;
  console.log(JSON.stringify(heroes, null, 2));

  console.log('--- SubCategory ---');
  const subs = await (prisma as any).$queryRaw`SELECT id, "imageUrl" FROM "SubCategory" LIMIT 5`;
  console.log(JSON.stringify(subs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
