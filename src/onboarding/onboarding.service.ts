import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OnboardingService {
    constructor(private prisma: PrismaService) { }

    findAll() {
        return this.prisma.onboardingScreen.findMany({
            orderBy: { order: 'asc' },
        });
    }

    create(data: any) {
        return this.prisma.onboardingScreen.create({
            data,
        });
    }

    update(id: number, data: any) {
        return this.prisma.onboardingScreen.update({
            where: { id },
            data,
        });
    }

    remove(id: number) {
        return this.prisma.onboardingScreen.delete({
            where: { id },
        });
    }
}
