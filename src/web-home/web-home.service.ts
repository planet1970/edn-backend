import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebHeroDto } from './dto/create-web-hero.dto';
import { UpdateWebHeroDto } from './dto/update-web-hero.dto';
import { UpdateSocialInfoDto } from './dto/update-social-info.dto';
import { UpdateNavbarDto } from './dto/update-navbar.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WebHomeService {
    constructor(private prisma: PrismaService) { }

    // --- HERO SLIDES ---

    async createHero(createDto: CreateWebHeroDto, file?: Express.Multer.File) {
        try {
            let imageUrl = createDto.imageUrl;

            if (file) {
                const uploadPath = path.join(process.cwd(), 'uploads', 'hero');
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                const fileName = `${Date.now()}-${file.originalname}`;
                const filePath = path.join(uploadPath, fileName);
                fs.writeFileSync(filePath, file.buffer);
                imageUrl = `/uploads/hero/${fileName}`;
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
            const uploadPath = path.join(process.cwd(), 'uploads', 'hero');
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            const fileName = `${Date.now()}-${file.originalname}`;
            const filePath = path.join(uploadPath, fileName);
            fs.writeFileSync(filePath, file.buffer);
            imageUrl = `/uploads/hero/${fileName}`;
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

        // Optionally delete file
        if (slide.imageUrl && slide.imageUrl.startsWith('/uploads/hero/')) {
            try {
                const filePath = path.join(process.cwd(), slide.imageUrl.substring(1)); // remove leading slash
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (e) {
                console.warn("Failed to delete file", e);
            }
        }

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
            const uploadPath = path.join(process.cwd(), 'uploads', 'logo');
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            const fileName = `${Date.now()}-${file.originalname}`;
            const filePath = path.join(uploadPath, fileName);
            fs.writeFileSync(filePath, file.buffer);
            logoUrl = `/uploads/logo/${fileName}`;
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
}
