import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../common/upload/upload.service';

@Injectable()
export class PopularPlacesService {
    constructor(
        private prisma: PrismaService,
        private readonly uploadService: UploadService,
    ) { }

    async findAll() {
        return this.prisma.popularPlaceAdvertisement.findMany({
            orderBy: { order: 'asc' }
        });
    }

    async findActive() {
        return this.prisma.popularPlaceAdvertisement.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' }
        });
    }

    async create(dto: any) {
        const lastItem = await this.prisma.popularPlaceAdvertisement.findFirst({
            orderBy: { order: 'desc' }
        });
        const nextOrder = (lastItem?.order || 0) + 1;

        return this.prisma.popularPlaceAdvertisement.create({
            data: {
                ...dto,
                order: dto.order ? Number(dto.order) : nextOrder,
                rating: dto.rating ? Number(dto.rating) : 0,
                visitCount: dto.visitCount ? Number(dto.visitCount) : 0,
            }
        });
    }

    async update(id: number, dto: any) {
        // Fetch old record for image deletion
        const oldRecord = await this.prisma.popularPlaceAdvertisement.findUnique({ where: { id } });

        if (dto.imageUrl && oldRecord?.imageUrl && dto.imageUrl !== oldRecord.imageUrl) {
            await this.uploadService.deleteFile(oldRecord.imageUrl);
        }

        return this.prisma.popularPlaceAdvertisement.update({
            where: { id },
            data: {
                ...dto,
                order: dto.order ? Number(dto.order) : undefined,
                rating: dto.rating ? Number(dto.rating) : undefined,
                visitCount: dto.visitCount ? Number(dto.visitCount) : undefined,
            }
        });
    }

    async remove(id: number) {
        return this.prisma.popularPlaceAdvertisement.delete({ where: { id } });
    }

    async reorder(ids: number[]) {
        return Promise.all(
            ids.map((id, index) =>
                this.prisma.popularPlaceAdvertisement.update({
                    where: { id },
                    data: { order: index + 1 }
                })
            )
        );
    }
}
