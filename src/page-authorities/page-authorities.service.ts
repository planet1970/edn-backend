
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PageAuthoritiesService {
    constructor(private prisma: PrismaService) { }

    async getAuthorities(sourceType: string, sourceId: number) {
        return this.prisma.pageAuthority.findMany({
            where: { sourceType, sourceId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        imageUrl: true
                    }
                }
            }
        });
    }

    async addAuthority(sourceType: string, sourceId: number, userId: number) {
        // Check if user exists and is a CUSTOMER
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
        // We'll trust the frontend to filter customers, but we can check here too
        // if (user.roleId !== 'CUSTOMER') throw new ConflictException('Sadece Müşteri tipindeki kullanıcılar yetkilendirilebilir');

        try {
            return await this.prisma.pageAuthority.create({
                data: {
                    sourceType,
                    sourceId,
                    userId
                }
            });
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('Bu kullanıcı zaten bu sayfa için yetkili');
            }
            throw error;
        }
    }

    async removeAuthority(id: number) {
        return this.prisma.pageAuthority.delete({
            where: { id }
        });
    }

    async getCustomers() {
        return this.prisma.user.findMany({
            where: { roleId: 'CUSTOMER' },
            select: {
                id: true,
                name: true,
                email: true
            }
        });
    }

    // New for MyPages simulation
    async getAssignedCustomers() {
        const authorities = await this.prisma.pageAuthority.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        // Group by user and include page names
        // This is a bit complex since sourceType+sourceId needs to fetch from 2 tables
        const results = [];
        for (const auth of authorities) {
            let pageTitle = 'Bilinmeyen Sayfa';
            if (auth.sourceType === 'PLACE') {
                const p = await this.prisma.place.findUnique({ where: { id: auth.sourceId }, select: { title: true } });
                if (p) pageTitle = p.title;
            } else if (auth.sourceType === 'FOOD_PLACE') {
                const f = await this.prisma.foodPlace.findUnique({ where: { id: auth.sourceId }, select: { title: true } });
                if (f) pageTitle = f.title;
            }

            results.push({
                userId: auth.userId,
                userName: auth.user.name || auth.user.email,
                pageId: auth.sourceId,
                pageType: auth.sourceType,
                pageTitle: pageTitle
            });
        }
        return results;
    }
}
