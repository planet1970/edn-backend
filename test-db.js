
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const visitors = await prisma.visitor.findMany({ take: 1 });
        console.log('Visitor table access successful:', visitors);
    } catch (error) {
        console.error('Visitor table access failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
