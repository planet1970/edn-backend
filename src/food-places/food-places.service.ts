import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFoodPlaceDto } from './dto/create-food-place.dto';
import { UpdateFoodPlaceDto } from './dto/update-food-place.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../common/upload/upload.service';

@Injectable()
export class FoodPlacesService {
    constructor(
        private prisma: PrismaService,
        private readonly uploadService: UploadService,
    ) { }

    async create(createFoodPlaceDto: CreateFoodPlaceDto) {
        try {
            const data: any = { ...createFoodPlaceDto };

            if (data.subCategoryId !== undefined) {
                const subCatId = typeof data.subCategoryId === 'string' ? parseInt(data.subCategoryId, 10) : data.subCategoryId;
                if (subCatId && !isNaN(subCatId)) {
                    data.subCategory = { connect: { id: subCatId } };
                } else {
                    delete data.subCategory;
                }
                delete data.subCategoryId;
            } else {
                delete data.subCategory;
            }

            // Remove read-only or invalid fields that might come from frontend's Object.keys() spread
            delete data.id;
            delete data.createdAt;
            delete data.updatedAt;
            delete data.story; // From older frontend version
            delete data.createdBy;
            delete data.updatedBy;
            delete data.createdById;
            delete data.updatedById;

            // Handle numeric and boolean fields from FormData
            if (data.rating !== undefined) {
                if (typeof data.rating === 'string') {
                    const parsed = parseFloat(data.rating);
                    data.rating = isNaN(parsed) ? null : parsed;
                } else if (isNaN(data.rating)) {
                    data.rating = null;
                }
            }
            if (data.isActive !== undefined && typeof data.isActive === 'string') data.isActive = data.isActive === 'true';

            return await this.prisma.foodPlace.create({
                data: data,
            });
        } catch (error) {
            console.error('Error creating food place:', error);
            throw error;
        }
    }

    async findAll(subCategoryId?: number) {
        console.log('FoodPlacesService.findAll starting execution for subCategoryId:', subCategoryId);
        try {
            const where: any = {};
            if (subCategoryId) where.subCategoryId = subCategoryId;

            const results = await this.prisma.foodPlace.findMany({
                where,
                include: { subCategory: true },
                orderBy: { order: 'asc' }
            });
            console.log(`FoodPlacesService.findAll success, found ${results.length} items.`);
            return results;
        } catch (error) {
            console.error('CRITICAL ERROR in FoodPlacesService.findAll:', error);
            // Deep fallback
            try {
                const results = await this.prisma.foodPlace.findMany();
                return results;
            } catch (innerError) {
                console.error('DEEP FALLBACK FAILED:', innerError);
                return [];
            }
        }
    }

    async findOne(id: number) {
        console.log('FoodPlacesService.findOne starting for id:', id);
        try {
            return await this.prisma.foodPlace.findUnique({
                where: { id },
                include: { subCategory: true },
            });
        } catch (error) {
            console.error('CRITICAL ERROR in FoodPlacesService.findOne:', error);
            return await this.prisma.foodPlace.findUnique({ where: { id } });
        }
    }

    async update(id: number, updateFoodPlaceDto: UpdateFoodPlaceDto, file?: Express.Multer.File, backFile?: Express.Multer.File) {
        try {
            const existing = await this.prisma.foodPlace.findUnique({ where: { id } });
            if (!existing) throw new NotFoundException('Food place not found');

            const data: any = { ...updateFoodPlaceDto };

            if (file) {
                data.imageUrl = await this.uploadService.handleFile(file, 'foods', existing.imageUrl);
            }
            if (backFile) {
                data.backImageUrl = await this.uploadService.handleFile(backFile, 'foods', existing.backImageUrl);
            }

            if (data.subCategoryId !== undefined) {
                const subCatId = typeof data.subCategoryId === 'string' ? parseInt(data.subCategoryId, 10) : data.subCategoryId;
                if (subCatId && !isNaN(subCatId)) {
                    data.subCategory = { connect: { id: subCatId } };
                } else {
                    delete data.subCategory;
                }
                delete data.subCategoryId;
            } else {
                delete data.subCategory;
            }

            // Remove read-only or invalid fields
            delete data.id;
            delete data.createdAt;
            delete data.updatedAt;
            delete data.story; 
            delete data.createdBy;
            delete data.updatedBy;
            delete data.createdById;
            delete data.updatedById;

            // Handle numeric and boolean fields from FormData
            if (data.rating !== undefined) {
                if (typeof data.rating === 'string') {
                    const parsed = parseFloat(data.rating);
                    data.rating = isNaN(parsed) ? null : parsed;
                } else if (isNaN(data.rating)) {
                    data.rating = null;
                }
            }
            if (data.isActive !== undefined && typeof data.isActive === 'string') data.isActive = data.isActive === 'true';

            return await this.prisma.foodPlace.update({
                where: { id },
                data: data,
            });
        } catch (error) {
            console.error('Error updating food place:', error);
            throw error;
        }
    }

    async remove(id: number) {
        const existing = await this.prisma.foodPlace.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Food place not found');

        // Cleanup files
        if (existing.imageUrl) await this.uploadService.deleteFile(existing.imageUrl);
        if (existing.backImageUrl) await this.uploadService.deleteFile(existing.backImageUrl);
        if (existing.campaignUrl) await this.uploadService.deleteFile(existing.campaignUrl);

        return this.prisma.foodPlace.delete({
            where: { id },
        });
    }

    async reorder(ids: number[]) {
        return this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.foodPlace.update({
                    where: { id },
                    data: { order: index + 1 },
                })
            )
        );
    }
}
