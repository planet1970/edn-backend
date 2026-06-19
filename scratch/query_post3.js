const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.socialMediaPost.findUnique({where: {id: 3}}).then(p => {
  console.log(p);
  if (p && p.imageUrl) {
    const filePath = 'd:/EDN-PROJE/edn-backend' + p.imageUrl;
    console.log('File exists:', fs.existsSync(filePath), filePath);
  }
}).finally(() => prisma.$disconnect());
