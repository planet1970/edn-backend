import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
    constructor(private prisma: PrismaService) { }

    async getDashboardStats() {
        const [
            totalUsers,
            totalCategories,
            totalSubCategories,
            totalPlaces,
            totalFoodPlaces,
            pendingContactMessages,
            totalVisitors,
            topPopupAds,
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.category.count(),
            this.prisma.subCategory.count(),
            (this.prisma as any).place.count(),
            (this.prisma as any).foodPlace.count(),
            (this.prisma as any).contactMessage.count({ where: { status: 'Bekliyor' } }),
            (this.prisma as any).visitor.count(),
            (this.prisma as any).webPopupAd.findMany({
                take: 5,
                orderBy: { viewCount: 'desc' },
                select: { id: true, title: true, viewCount: true, imageUrl: true }
            }),
        ]);

        return {
            totalUsers,
            totalCategories,
            totalSubCategories,
            totalPlaces,
            totalFoodPlaces,
            pendingContactMessages,
            totalVisitors,
            topPopupAds,
        };
    }
}
