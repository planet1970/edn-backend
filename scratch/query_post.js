const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.socialMediaPost.findMany({ orderBy: { createdAt: 'desc' }, take: 1 })
  .then(console.log)
  .finally(() => prisma.$disconnect());
