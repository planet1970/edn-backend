import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadService } from 'src/common/upload/upload.service';

@Injectable()
export class SplashService {
    constructor(
        private prisma: PrismaService,
        private readonly uploadService: UploadService
    ) { }

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

    async update(data: any, file?: Express.Multer.File) {
        const existing = await this.prisma.splashScreen.findFirst();
        
        if (file) {
            data.logoUrl = await this.uploadService.handleFile(file, 'main', existing?.logoUrl);
        }

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
