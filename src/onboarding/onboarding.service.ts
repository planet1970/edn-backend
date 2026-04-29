import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadService } from 'src/common/upload/upload.service';

@Injectable()
export class OnboardingService {
    constructor(
        private prisma: PrismaService,
        private readonly uploadService: UploadService
    ) { }

    findAll() {
        return this.prisma.onboardingScreen.findMany({
            orderBy: { order: 'asc' },
        });
    }

    async create(data: any, file?: Express.Multer.File) {
        if (file) {
            data.imageUrl = await this.uploadService.handleFile(file, 'onboarding');
        }
        return this.prisma.onboardingScreen.create({
            data,
        });
    }

    async update(id: number, data: any, file?: Express.Multer.File) {
        const existing = await this.prisma.onboardingScreen.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Screen not found');

        if (file) {
            data.imageUrl = await this.uploadService.handleFile(file, 'onboarding', existing.imageUrl);
        }

        return this.prisma.onboardingScreen.update({
            where: { id },
            data,
        });
    }

    async remove(id: number) {
        const existing = await this.prisma.onboardingScreen.findUnique({ where: { id } });
        if (existing?.imageUrl) {
            await this.uploadService.deleteFile(existing.imageUrl);
        }
        return this.prisma.onboardingScreen.delete({
            where: { id },
        });
    }
}
