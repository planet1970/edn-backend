
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    // Seed UserTypes
    const roles = [
        { id: 'ADMIN', title: 'Admin', description: 'Tam yetkili yönetici', isSystem: true },
        { id: 'USER', title: 'User', description: 'Standart kullanıcı', isSystem: true },
        { id: 'CUSTOMER', title: 'Customer', description: 'Müşteri / İşletme sahibi', isSystem: true },
    ];

    for (const role of roles) {
        await prisma.userType.upsert({
            where: { id: role.id },
            update: role,
            create: role,
        });
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
            email: 'admin@example.com',
            password: hashedPassword,
            name: 'Admin',
            roleId: 'ADMIN',
        },
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
