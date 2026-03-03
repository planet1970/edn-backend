import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PopularPlacesService {
    constructor(private prisma: PrismaService) { }

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
        return this.prisma.popularPlaceAdvertisement.create({
            data: {
                ...dto,
                order: Number(dto.order || 0),
                rating: dto.rating ? Number(dto.rating) : 0,
                visitCount: dto.visitCount ? Number(dto.visitCount) : 0,
            }
        });
    }

    async update(id: number, dto: any) {
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
