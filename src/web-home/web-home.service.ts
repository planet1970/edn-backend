import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebHeroDto } from './dto/create-web-hero.dto';
import { UpdateWebHeroDto } from './dto/update-web-hero.dto';
import { UpdateSocialInfoDto } from './dto/update-social-info.dto';
import { UpdateNavbarDto } from './dto/update-navbar.dto';
import { UploadService } from '../common/upload/upload.service';

@Injectable()
export class WebHomeService {
    constructor(
        private prisma: PrismaService,
        private readonly uploadService: UploadService,
    ) { }

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
            where: { isActive: true },
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

    // --- FEATURED ADVERTISEMENTS ---

    async findAllFeaturedAds() {
        return this.prisma.featuredAdvertisement.findMany({
            where: { isActive: true },
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
}
