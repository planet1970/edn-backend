import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const navbar = await prisma.webNavbar.findFirst();
    console.log('Current Navbar in DB:', JSON.stringify(navbar, null, 2));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
