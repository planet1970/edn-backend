import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
    constructor(private prisma: PrismaService) { }

    async incrementDailyVisit(platform: 'web' | 'mobile', isUnique: boolean = false, isSearch: boolean = false) {
        // Türkiye saatine göre bugünün tarihini al (YYYY-MM-DD formatında)
        const turkeyDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
        
        // Bu tarihi UTC 00:00 olarak ayarla (DB'de temiz görünmesi için)
        const today = new Date(turkeyDateStr + 'T00:00:00Z');

        const where = { date: today };
        const updateData: any = {
            totalCount: { increment: 1 }
        };

        if (platform === 'web') {
            updateData.webCount = { increment: 1 };
        } else {
            updateData.mobileCount = { increment: 1 };
        }

        if (isUnique) {
            updateData.uniqueCount = { increment: 1 };
        }

        if (isSearch) {
            updateData.searchCount = { increment: 1 };
        }

        return this.prisma.dailyVisitStats.upsert({
            where,
            update: updateData,
            create: {
                date: today,
                webCount: platform === 'web' ? 1 : 0,
                mobileCount: platform === 'mobile' ? 1 : 0,
                uniqueCount: isUnique ? 1 : 0,
                searchCount: isSearch ? 1 : 0,
                totalCount: 1
            }
        });
    }

    async getDailyStats(days: number = 5) {
        const stats = await this.prisma.dailyVisitStats.findMany({
            take: days,
            orderBy: { date: 'desc' },
        });

        // Fill missing days with 0 if needed, but for Top 5 the user just wants the records
        return stats.reverse();
    }

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
            dailyStats
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.category.count(),
            this.prisma.subCategory.count(),
            this.prisma.place.count(),
            this.prisma.foodPlace.count(),
            this.prisma.contactMessage.count({ where: { status: 'Bekliyor' } }),
            this.prisma.visitor.count(),
            this.prisma.webPopupAd.findMany({
                take: 5,
                orderBy: { viewCount: 'desc' },
                select: { id: true, title: true, viewCount: true, imageUrl: true }
            }),
            this.getDailyStats(5)
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
            dailyStats
        };
    }
}
