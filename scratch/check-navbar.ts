
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const navbar = await prisma.webNavbar.findFirst();
  console.log(JSON.stringify(navbar, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
