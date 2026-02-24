import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SplashService {
    constructor(private prisma: PrismaService) { }

    async find() {
        const splash = await this.prisma.splashScreen.findFirst();
        if (!splash) {
            return {
                backgroundColor: '#F97316',
                duration: 3000,
                tagline: 'Şehir Rehberi',
                logoUrl: '',
            };
        }
        return splash;
    }

    async update(data: any) {
        const existing = await this.prisma.splashScreen.findFirst();
        if (existing) {
            return this.prisma.splashScreen.update({
                where: { id: existing.id },
                data,
            });
        } else {
            return this.prisma.splashScreen.create({
                data,
            });
        }
    }
}
