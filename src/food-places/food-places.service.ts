import { Injectable } from '@nestjs/common';
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
        try {
            const where: any = {};
            if (subCategoryId) where.subCategoryId = subCategoryId;

            return await this.prisma.foodPlace.findMany({
                where,
                include: { subCategory: true },
            });
        } catch (error) {
            console.error('Error finding food places:', error);
            // Fallback: try without include if relations are broken
            const where: any = {};
            if (subCategoryId) where.subCategoryId = subCategoryId;
            return await this.prisma.foodPlace.findMany({ where });
        }
    }

    async findOne(id: number) {
        try {
            return await this.prisma.foodPlace.findUnique({
                where: { id },
                include: { subCategory: true },
            });
        } catch (error) {
            console.error('Error finding food place:', error);
            return await this.prisma.foodPlace.findUnique({ where: { id } });
        }
    }

    async update(id: number, updateFoodPlaceDto: UpdateFoodPlaceDto) {
        try {
            const data: any = { ...updateFoodPlaceDto };

            // Fetch old record for image deletion
            const oldRecord = await this.prisma.foodPlace.findUnique({ where: { id } });

            if (data.imageUrl && oldRecord?.imageUrl && data.imageUrl !== oldRecord.imageUrl) {
                await this.uploadService.deleteFile(oldRecord.imageUrl);
            }

            if (data.backImageUrl && oldRecord?.backImageUrl && data.backImageUrl !== oldRecord.backImageUrl) {
                await this.uploadService.deleteFile(oldRecord.backImageUrl);
            }

            if (data.subCategoryId !== undefined) {
                const subCatId = typeof data.subCategoryId === 'string' ? parseInt(data.subCategoryId, 10) : data.subCategoryId;
                if (subCatId && !isNaN(subCatId)) {
                    data.subCategory = { connect: { id: subCatId } };
                } else {
                    delete data.subCategory; // Ensure invalid string is removed if no subCatId
                }
                delete data.subCategoryId;
            } else {
                delete data.subCategory; // Explicitly remove any subCategory string passed by FormData
            }

            // Remove read-only or invalid fields that might come from frontend's Object.keys() spread
            delete data.id;
            delete data.createdAt;
            delete data.updatedAt;
            delete data.story; // From older frontend version to prevent crash
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

    remove(id: number) {
        return this.prisma.foodPlace.delete({
            where: { id },
        });
    }
}
