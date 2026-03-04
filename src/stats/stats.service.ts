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
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.category.count(),
            this.prisma.subCategory.count(),
            (this.prisma as any).place.count(),
            (this.prisma as any).foodPlace.count(),
            (this.prisma as any).contactMessage.count({ where: { status: 'Bekliyor' } }),
            (this.prisma as any).visitor.count(),
        ]);

        return {
            totalUsers,
            totalCategories,
            totalSubCategories,
            totalPlaces,
            totalFoodPlaces,
            pendingContactMessages,
            totalVisitors,
        };
    }
}
