import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebHeroDto } from './dto/create-web-hero.dto';
import { UpdateWebHeroDto } from './dto/update-web-hero.dto';
import { UpdateSocialInfoDto } from './dto/update-social-info.dto';
import { UpdateNavbarDto } from './dto/update-navbar.dto';
import { UploadService } from '../common/upload/upload.service';
import * as Parser from 'rss-parser';

@Injectable()
export class WebHomeService {
    constructor(
        private prisma: PrismaService,
        private readonly uploadService: UploadService,
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async syncPopupAdStatuses() {
        const now = new Date();

        // 1. Deactivate ads that have expired
        await this.prisma.webPopupAd.updateMany({
            where: {
                isActive: true,
                endDate: { lt: now }
            },
            data: { isActive: false }
        });

        // 2. Handle scheduled activation and "active ad deactivation"
        // Find ads that are currently valid (started and not expired)
        const validAds = await this.prisma.webPopupAd.findMany({
            where: {
                isActive: true,
                OR: [
                    { startDate: null },
                    { startDate: { lte: now } }
                ],
                AND: [
                    {
                        OR: [
                            { endDate: null },
                            { endDate: { gte: now } }
                        ]
                    }
                ]
            }
        });

        if (validAds.length > 0) {
            const bestAd = validAds.sort((a, b) => {
                if (a.isDefault && !b.isDefault) return 1;
                if (!a.isDefault && b.isDefault) return -1;
                if (a.startDate && !b.startDate) return -1;
                if (!a.startDate && b.startDate) return 1;
                if (a.startDate && b.startDate) return b.startDate.getTime() - a.startDate.getTime();
                return b.id - a.id;
            })[0];

            // If the best ad is NOT the default one, and we have multiple active, 
            // we should deactivate other non-default ads that are currently valid.
            // If the best ad IS the default one, we don't need to deactivate others 
            // because they are either not valid yet or deactivated.
            if (!bestAd.isDefault) {
                await this.prisma.webPopupAd.updateMany({
                    where: {
                        id: { not: bestAd.id },
                        isActive: true,
                        isDefault: false,
                        OR: [
                            { startDate: null },
                            { startDate: { lte: now } }
                        ]
                    },
                    data: { isActive: false }
                });
            }
        }
    }

    // --- HERO SLIDES ---

    async createHero(createDto: CreateWebHeroDto, file?: Express.Multer.File) {
        try {
            let imageUrl = createDto.imageUrl;

            if (file) {
                imageUrl = await this.uploadService.handleFile(file, 'hero');
            }

            return await this.prisma.webHeroSlide.create({
                data: {
                    ...createDto,
                    order: createDto.order ? Number(createDto.order) : 0,
                    imageUrl
                },
            });
        } catch (error) {
            console.error(error);
            throw new InternalServerErrorException('Failed to create hero slide');
        }
    }

    async findAllHero() {
        return this.prisma.webHeroSlide.findMany({
            orderBy: { order: 'asc' },
        });
    }

    async updateHero(id: string, updateDto: UpdateWebHeroDto, file?: Express.Multer.File) {
        const slide = await this.prisma.webHeroSlide.findUnique({ where: { id } });
        if (!slide) throw new NotFoundException('Hero slide not found');

        let imageUrl = updateDto.imageUrl || slide.imageUrl;

        if (file) {
            if (slide.imageUrl) {
                await this.uploadService.deleteFile(slide.imageUrl);
            }
            imageUrl = await this.uploadService.handleFile(file, 'hero');
        }

        return this.prisma.webHeroSlide.update({
            where: { id },
            data: {
                ...updateDto,
                order: updateDto.order ? Number(updateDto.order) : undefined,
                imageUrl
            },
        });
    }

    async removeHero(id: string) {
        const slide = await this.prisma.webHeroSlide.findUnique({ where: { id } });
        if (!slide) throw new NotFoundException('Hero slide not found');

        return this.prisma.webHeroSlide.delete({ where: { id } });
    }

    // --- SOCIAL INFO ---

    async getSocialInfo() {
        const info = await this.prisma.webSocialInfo.findFirst();
        if (!info) {
            // Return default empty structure or create one
            return {};
        }
        return info;
    }

    async updateSocialInfo(updateDto: UpdateSocialInfoDto) {
        const existing = await this.prisma.webSocialInfo.findFirst();

        if (existing) {
            return this.prisma.webSocialInfo.update({
                where: { id: existing.id },
                data: updateDto
            });
        } else {
            return this.prisma.webSocialInfo.create({
                data: updateDto
            })
        }
    }

    // --- NAVBAR ---

    async getNavbar() {
        const navbar = await this.prisma.webNavbar.findFirst();
        return navbar || {};
    }

    async updateNavbar(updateDto: UpdateNavbarDto, file?: Express.Multer.File) {
        const existing = await this.prisma.webNavbar.findFirst();
        let logoUrl = updateDto.logoUrl;

        if (file) {
            if (existing?.logoUrl) {
                await this.uploadService.deleteFile(existing.logoUrl);
            }
            logoUrl = await this.uploadService.handleFile(file, 'logo');
        }

        console.log('Update Navbar DTO:', updateDto);

        const data: any = {};
        if (updateDto.title !== undefined) data.title = updateDto.title;
        if (updateDto.titleColor !== undefined) data.titleColor = updateDto.titleColor;
        if (updateDto.fontFamily !== undefined) data.fontFamily = updateDto.fontFamily;
        if (updateDto.fontSize !== undefined) data.fontSize = Number(updateDto.fontSize);
        if (updateDto.bgColor !== undefined) data.bgColor = updateDto.bgColor;
        if (updateDto.iconColor !== undefined) data.iconColor = updateDto.iconColor;
        if (logoUrl !== undefined) data.logoUrl = logoUrl;

        console.log('Data to be saved:', data);

        if (existing) {
            return this.prisma.webNavbar.update({
                where: { id: existing.id },
                data: {
                    ...data,
                    updatedAt: new Date()
                }
            });
        } else {
            return this.prisma.webNavbar.create({
                data: {
                    ...data,
                }
            });
        }
    }

    // --- STORY ADVERTISEMENTS ---

    async findAllStoryAds() {
        return this.prisma.storyAdvertisement.findMany({
            orderBy: { order: 'asc' }
        });
    }

    async createStoryAd(dto: any) {
        return this.prisma.storyAdvertisement.create({
            data: {
                ...dto,
                order: Number(dto.order || 0),
                isNew: dto.isNew === 'true' || dto.isNew === true,
            }
        });
    }

    async updateStoryAd(id: number, dto: any) {
        // Fetch old record for image deletion
        const oldRecord = await this.prisma.storyAdvertisement.findUnique({ where: { id } });

        if (dto.imageUrl && oldRecord?.imageUrl && dto.imageUrl !== oldRecord.imageUrl) {
            await this.uploadService.deleteFile(oldRecord.imageUrl);
        }

        return this.prisma.storyAdvertisement.update({
            where: { id },
            data: {
                ...dto,
                order: dto.order ? Number(dto.order) : undefined,
                isNew: dto.isNew !== undefined ? (dto.isNew === 'true' || dto.isNew === true) : undefined,
            }
        });
    }

    async removeStoryAd(id: number) {
        return this.prisma.storyAdvertisement.delete({ where: { id } });
    }

    async reorderStoryAds(ids: number[]) {
        return Promise.all(
            ids.map((id, index) =>
                this.prisma.storyAdvertisement.update({
                    where: { id },
                    data: { order: index + 1 }
                })
            )
        );
    }

    // --- FEATURED ADVERTISEMENTS ---

    async findAllFeaturedAds() {
        return this.prisma.featuredAdvertisement.findMany({
            orderBy: { order: 'asc' }
        });
    }

    async createFeaturedAd(dto: any) {
        return this.prisma.featuredAdvertisement.create({
            data: {
                ...dto,
                order: Number(dto.order || 0),
                rating: dto.rating ? Number(dto.rating) : 0,
            }
        });
    }

    async updateFeaturedAd(id: number, dto: any) {
        // Fetch old record for image deletion
        const oldRecord = await this.prisma.featuredAdvertisement.findUnique({ where: { id } });

        if (dto.imageUrl && oldRecord?.imageUrl && dto.imageUrl !== oldRecord.imageUrl) {
            await this.uploadService.deleteFile(oldRecord.imageUrl);
        }

        return this.prisma.featuredAdvertisement.update({
            where: { id },
            data: {
                ...dto,
                order: dto.order ? Number(dto.order) : undefined,
                rating: dto.rating ? Number(dto.rating) : undefined,
            }
        });
    }

    async removeFeaturedAd(id: number) {
        return this.prisma.featuredAdvertisement.delete({ where: { id } });
    }

    async reorderFeaturedAds(ids: number[]) {
        return Promise.all(
            ids.map((id, index) =>
                this.prisma.featuredAdvertisement.update({
                    where: { id },
                    data: { order: index + 1 }
                })
            )
        );
    }

    // --- GOOGLE ADS ---

    async findAllGoogleAds() {
        return this.prisma.webGoogleAd.findMany();
    }

    async updateGoogleAd(areaName: string, dto: any, file?: Express.Multer.File) {
        const existing = await this.prisma.webGoogleAd.findUnique({
            where: { areaName }
        });

        let imageUrl = dto.imageUrl || existing?.imageUrl;

        if (file) {
            // Delete old image if exists
            if (existing?.imageUrl) {
                await this.uploadService.deleteFile(existing.imageUrl);
            }
            imageUrl = await this.uploadService.handleFile(file, 'ads');
        }

        // Handle case where user switches from IMAGE to SCRIPT
        if (dto.type === 'SCRIPT' && existing?.imageUrl && !file) {
            await this.uploadService.deleteFile(existing.imageUrl);
            imageUrl = null;
        }

        const data: any = {
            areaName,
            type: dto.type,
            scriptCode: dto.scriptCode !== undefined ? dto.scriptCode : existing?.scriptCode,
            linkUrl: dto.linkUrl !== undefined ? dto.linkUrl : existing?.linkUrl,
            isActive: dto.isActive !== undefined ? (dto.isActive === 'true' || dto.isActive === true) : (existing?.isActive ?? true),
            imageUrl
        };

        if (existing) {
            return this.prisma.webGoogleAd.update({
                where: { areaName },
                data
            });
        } else {
            return this.prisma.webGoogleAd.create({
                data
            });
        }
    }

    async removeGoogleAd(areaName: string) {
        const existing = await this.prisma.webGoogleAd.findUnique({
            where: { areaName }
        });

        if (existing?.imageUrl) {
            await this.uploadService.deleteFile(existing.imageUrl);
        }

        if (existing) {
            return this.prisma.webGoogleAd.delete({
                where: { areaName }
            });
        }
    }

    // --- POPULAR PLACE ADVERTISEMENTS ---

    async findAllPopularAds() {
        return this.prisma.popularPlaceAdvertisement.findMany({
            orderBy: { order: 'asc' }
        });
    }

    async createPopularAd(dto: any) {
        return this.prisma.popularPlaceAdvertisement.create({
            data: {
                ...dto,
                order: Number(dto.order || 0),
                rating: dto.rating ? Number(dto.rating) : 0,
                visitCount: dto.visitCount ? Number(dto.visitCount) : 0,
            }
        });
    }

    async updatePopularAd(id: number, dto: any) {
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

    async removePopularAd(id: number) {
        return this.prisma.popularPlaceAdvertisement.delete({ where: { id } });
    }

    async reorderPopularAds(ids: number[]) {
        return Promise.all(
            ids.map((id, index) =>
                this.prisma.popularPlaceAdvertisement.update({
                    where: { id },
                    data: { order: index + 1 }
                })
            )
        );
    }

    // --- ABOUT SECTION ---

    async getAboutSection() {
        let section = await this.prisma.webAboutSection.findFirst({
            include: { cards: { orderBy: { order: 'asc' } } }
        });

        if (!section) {
            // Create default if not exists
            section = await this.prisma.webAboutSection.create({
                data: {
                    title: "HADRİANOUPOLİS'TEN EDİRNE'YE",
                    description: "İlginç Bilgiler"
                },
                include: { cards: true }
            });
        }
        return section;
    }

    async updateAboutSection(dto: any) {
        const existing = await this.prisma.webAboutSection.findFirst();
        if (existing) {
            return this.prisma.webAboutSection.update({
                where: { id: existing.id },
                data: {
                    title: dto.title,
                    description: dto.description
                }
            });
        } else {
            return this.prisma.webAboutSection.create({
                data: {
                    title: dto.title,
                    description: dto.description
                }
            });
        }
    }

    async createAboutCard(dto: any) {
        const section = await this.getAboutSection();
        return this.prisma.webAboutCard.create({
            data: {
                ...dto,
                sectionId: section.id,
                order: Number(dto.order || 0),
                isActive: dto.isActive === 'true' || dto.isActive === true
            }
        });
    }

    async updateAboutCard(id: number, dto: any) {
        return this.prisma.webAboutCard.update({
            where: { id },
            data: {
                ...dto,
                order: dto.order ? Number(dto.order) : undefined,
                isActive: dto.isActive !== undefined ? (dto.isActive === 'true' || dto.isActive === true) : undefined
            }
        });
    }

    async removeAboutCard(id: number) {
        return this.prisma.webAboutCard.delete({ where: { id } });
    }

    async reorderAboutCards(ids: number[]) {
        return Promise.all(
            ids.map((id, index) =>
                this.prisma.webAboutCard.update({
                    where: { id },
                    data: { order: index + 1 }
                })
            )
        );
    }
    // --- POPUP ADS ---

    async getPopupAds() {
        const now = new Date();
        // Proactively deactivate expired ads
        await this.prisma.webPopupAd.updateMany({
            where: {
                isActive: true,
                endDate: { lt: now }
            },
            data: { isActive: false }
        });

        return this.prisma.webPopupAd.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }

    async getActivePopupAd() {
        const now = new Date();

        // 1. Deactivate any expired ads first (Scheduled ads)
        await this.prisma.webPopupAd.updateMany({
            where: {
                isActive: true,
                endDate: { lt: now }
            },
            data: { isActive: false }
        });

        // 2. Find scheduled ads that are currently valid
        const ads = await this.prisma.webPopupAd.findMany({
            where: {
                isActive: true,
                OR: [
                    { startDate: null },
                    { startDate: { lte: now } }
                ],
                AND: [
                    {
                        OR: [
                            { endDate: null },
                            { endDate: { gte: now } }
                        ]
                    }
                ]
            }
        });

        if (ads.length > 0) {
            // Sort to find the highest priority scheduled ad
            const sorted = ads.sort((a, b) => {
                if (a.startDate && !b.startDate) return -1;
                if (!a.startDate && b.startDate) return 1;
                if (a.startDate && b.startDate) return b.startDate.getTime() - a.startDate.getTime();
                return b.id - a.id;
            });
            return sorted[0];
        }

        // 3. Fallback to Default Ad if no scheduled ads are active
        const defaultAd = await this.prisma.webDefaultPopup.findFirst({
            where: { isActive: true }
        });

        if (defaultAd) {
            return {
                ...defaultAd,
                isDefault: true
            };
        }

        return null;
    }

    async getDefaultPopupAd() {
        let def = await this.prisma.webDefaultPopup.findFirst();
        if (!def) {
            def = await this.prisma.webDefaultPopup.create({
                data: {
                    title: 'Varsayılan Reklam',
                    imageUrl: '',
                    isActive: false,
                    displayStrategy: 'ONCE_PER_HOUR'
                }
            });
        }
        return def;
    }

    async updateDefaultPopupAd(dto: any, file?: Express.Multer.File) {
        const existing = await this.getDefaultPopupAd();

        let imageUrl = dto.imageUrl || existing.imageUrl;
        if (file) {
            if (existing.imageUrl) {
                await this.uploadService.deleteFile(existing.imageUrl);
            }
            imageUrl = await this.uploadService.handleFile(file, 'ads');
        }

        return this.prisma.webDefaultPopup.update({
            where: { id: existing.id },
            data: {
                title: dto.title !== undefined ? dto.title : existing.title,
                linkUrl: dto.linkUrl !== undefined ? dto.linkUrl : existing.linkUrl,
                isActive: dto.isActive !== undefined ? (String(dto.isActive) === 'true' || dto.isActive === true || dto.isActive === 1 || dto.isActive === '1') : existing.isActive,
                displayStrategy: dto.displayStrategy !== undefined ? dto.displayStrategy : existing.displayStrategy,
                imageUrl
            }
        });
    }

    async createPopupAd(dto: any, file?: Express.Multer.File) {
        let imageUrl = dto.imageUrl;
        if (file) {
            imageUrl = await this.uploadService.handleFile(file, 'ads');
        }

        const isActive = dto.isActive === 'true' || dto.isActive === true;

        const startDate = (dto.startDate && dto.startDate !== '') ? new Date(dto.startDate) : null;
        const endDate = (dto.endDate && dto.endDate !== '') ? new Date(dto.endDate) : null;

        if (isActive) {
            const activeAds = await this.prisma.webPopupAd.findMany({
                where: {
                    isActive: true
                }
            });

            for (const ad of activeAds) {
                if (ad.endDate && startDate && startDate < ad.endDate) {
                    throw new BadRequestException(`Sistem Uyarısı: Yeni reklamın başlangıç tarihi (${startDate.toLocaleDateString('tr-TR')}), mevcut aktif reklamın ("${ad.title}") bitiş tarihinden (${ad.endDate.toLocaleDateString('tr-TR')}) önce olamaz.`);
                }
            }

            if (!startDate || startDate <= new Date()) {
                await this.prisma.webPopupAd.updateMany({
                    where: {
                        isActive: true
                    },
                    data: { isActive: false }
                });
            }
        }

        return this.prisma.webPopupAd.create({
            data: {
                title: dto.title,
                imageUrl,
                linkUrl: dto.linkUrl,
                isActive,
                startDate,
                endDate,
                displayStrategy: dto.displayStrategy || 'ONCE_PER_HOUR'
            }
        });
    }

    async incrementPopupView(id: number) {
        return this.prisma.webPopupAd.update({
            where: { id },
            data: {
                viewCount: {
                    increment: 1
                }
            }
        });
    }

    async updatePopupAd(id: number, dto: any, file?: Express.Multer.File) {
        const existing = await this.prisma.webPopupAd.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Popup ad not found');

        let imageUrl = dto.imageUrl || existing.imageUrl;
        if (file) {
            if (existing.imageUrl) {
                await this.uploadService.deleteFile(existing.imageUrl);
            }
            imageUrl = await this.uploadService.handleFile(file, 'ads');
        }

        const isActive = dto.isActive !== undefined ? (dto.isActive === 'true' || dto.isActive === true) : existing.isActive;
        const startDate = dto.startDate !== undefined ? ((dto.startDate && dto.startDate !== '') ? new Date(dto.startDate) : null) : existing.startDate;
        const endDate = dto.endDate !== undefined ? ((dto.endDate && dto.endDate !== '') ? new Date(dto.endDate) : null) : existing.endDate;

        if (isActive) {
            const activeAds = await this.prisma.webPopupAd.findMany({
                where: {
                    isActive: true,
                    id: { not: id }
                }
            });

            for (const ad of activeAds) {
                if (ad.endDate && startDate && startDate < ad.endDate) {
                    throw new BadRequestException(`Sistem Uyarısı: Reklamın başlangıç tarihi (${startDate.toLocaleDateString('tr-TR')}), mevcut aktif reklamın ("${ad.title}") bitiş tarihinden (${ad.endDate.toLocaleDateString('tr-TR')}) önce olamaz.`);
                }
            }

            if (!startDate || startDate <= new Date()) {
                await this.prisma.webPopupAd.updateMany({
                    where: {
                        id: { not: id },
                        isActive: true
                    },
                    data: { isActive: false }
                });
            }
        }

        return this.prisma.webPopupAd.update({
            where: { id },
            data: {
                title: dto.title !== undefined ? dto.title : existing.title,
                imageUrl,
                linkUrl: dto.linkUrl !== undefined ? dto.linkUrl : existing.linkUrl,
                isActive,
                startDate,
                endDate,
                displayStrategy: dto.displayStrategy !== undefined ? dto.displayStrategy : existing.displayStrategy
            }
        });
    }

    async removePopupAd(id: number) {
        const existing = await this.prisma.webPopupAd.findUnique({ where: { id } });
        if (existing?.imageUrl) {
            try {
                await this.uploadService.deleteFile(existing.imageUrl);
            } catch (e) {
                console.error("Could not delete file:", e);
            }
        }
        return this.prisma.webPopupAd.delete({ where: { id } });
    }

    // --- GOOGLE NEWS & CUSTOM NEWS ---
    private async syncNewsFromRSS() {
        try {
            const parser = new Parser();
            const url = 'https://news.google.com/rss/search?q=Edirne&hl=tr&gl=TR&ceid=TR:tr';
            const feed = await parser.parseURL(url);

            if (feed?.items) {
                for (const item of feed.items.slice(0, 15)) {
                    if (!item.link) continue;
                    try {
                        const existing = await this.prisma.webNewsItem.findUnique({
                            where: { link: item.link }
                        });

                        if (!existing) {
                            await this.prisma.webNewsItem.create({
                                data: {
                                    title: item.title || '',
                                    link: item.link,
                                    pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
                                    source: item.source || item.creator || 'Google Haberler',
                                    contentSnippet: (item.content || item.contentSnippet || '').substring(0, 1000),
                                    isActive: true,
                                    isManual: false
                                }
                            }).catch(() => { /* ignore concurrent creation errors */ });
                        }
                    } catch (e) {
                        // ignore individual item errors
                    }
                }
            }
        } catch (e) {
            console.error("RSS sync error:", e);
        }
    }

    async getEdirneNews() {
        try {
            const setting = await this.prisma.webSetting.findUnique({ where: { id: "GLOBAL" } });
            if (setting && !setting.isNewsActive) {
                return [];
            }

            await this.syncNewsFromRSS();

            return await this.prisma.webNewsItem.findMany({
                where: { isActive: true },
                orderBy: { pubDate: 'desc' },
                take: 10
            });
        } catch (error) {
            console.error("Haberler çekilemedi:", error);
            return [];
        }
    }

    // --- NEWS MANAGEMENT (ADMIN) ---
    async getNewsSettings() {
        return this.prisma.webSetting.upsert({
            where: { id: "GLOBAL" },
            update: {},
            create: { id: "GLOBAL", isNewsActive: true }
        });
    }

    async updateNewsSettings(isActive: boolean) {
        return this.prisma.webSetting.upsert({
            where: { id: "GLOBAL" },
            update: { isNewsActive: isActive },
            create: { id: "GLOBAL", isNewsActive: isActive }
        });
    }

    async getAllNewsItems() {
        try {
            await this.syncNewsFromRSS();
            const items = await this.prisma.webNewsItem.findMany({
                orderBy: { pubDate: 'desc' },
                take: 15
            });
            console.log(`Returning ${items.length} news items for admin.`);
            return items;
        } catch (error) {
            console.error("Error in getAllNewsItems:", error);
            return [];
        }
    }

    async toggleNewsItem(id: number, isActive: boolean) {
        return this.prisma.webNewsItem.update({
            where: { id },
            data: { isActive }
        });
    }

    async createManualNews(dto: { title: string, source: string, link: string, contentSnippet?: string }) {
        return this.prisma.webNewsItem.create({
            data: {
                title: dto.title,
                source: dto.source || 'Manuel Haber',
                link: dto.link,
                contentSnippet: dto.contentSnippet || '',
                pubDate: new Date(),
                isActive: true,
                isManual: true
            }
        });
    }

    async deleteNewsItem(id: number) {
        return this.prisma.webNewsItem.delete({ where: { id } });
    }
}
