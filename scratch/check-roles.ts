import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const roles = await prisma.userType.findMany();
  console.log('Roles in DB:', roles);
  await prisma.$disconnect();
}
main().catch(console.error);
