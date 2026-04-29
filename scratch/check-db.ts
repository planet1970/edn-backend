import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- PLACES ---');
  const places = await prisma.place.findMany({ take: 5 });
  places.forEach(p => console.log(`ID: ${p.id}, Title: ${p.title}, Pic: ${p.pic_url}`));

  console.log('\n--- SUBCATEGORIES ---');
  const subs = await prisma.subCategory.findMany({ take: 5 });
  subs.forEach(s => console.log(`ID: ${s.id}, Title: ${s.title}, Image: ${s.imageUrl}`));
  
  await prisma.$disconnect();
}

main().catch(console.error);
