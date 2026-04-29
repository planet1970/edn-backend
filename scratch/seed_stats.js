const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const stats = [];
  const now = new Date();
  
  for (let i = 4; i >= 0; i--) {
    const date = new Date();
    date.setDate(now.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    // Generate some random realistic looking data
    const web = Math.floor(Math.random() * 50) + 20;
    const mobile = Math.floor(Math.random() * 30) + 10;
    
    stats.push({
      date,
      webCount: web,
      mobileCount: mobile,
      totalCount: web + mobile
    });
  }

  for (const stat of stats) {
    await prisma.dailyVisitStats.upsert({
      where: { date: stat.date },
      update: stat,
      create: stat
    });
  }
  
  console.log('Seed completed for last 5 days.');
}

seed()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
