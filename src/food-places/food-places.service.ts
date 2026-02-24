import { Injectable } from '@nestjs/common';
import { CreateFoodPlaceDto } from './dto/create-food-place.dto';
import { UpdateFoodPlaceDto } from './dto/update-food-place.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FoodPlacesService {
    constructor(private prisma: PrismaService) { }

    async create(createFoodPlaceDto: CreateFoodPlaceDto) {
        const data: any = { ...createFoodPlaceDto };

        if (data.subCategoryId !== undefined) {
            const subCatId = typeof data.subCategoryId === 'string' ? parseInt(data.subCategoryId, 10) : data.subCategoryId;
            if (subCatId) {
                data.subCategory = { connect: { id: subCatId } };
            } else {
                delete data.subCategory;
            }
            delete data.subCategoryId;
        } else {
            delete data.subCategory;
        }

        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;
        delete data.story; // From older frontend version

        // Handle numeric and boolean fields from FormData
        if (data.rating !== undefined && typeof data.rating === 'string') data.rating = parseFloat(data.rating);
        if (data.isActive !== undefined && typeof data.isActive === 'string') data.isActive = data.isActive === 'true';

        return this.prisma.foodPlace.create({
            data: data,
        });
    }

    findAll(subCategoryId?: number) {
        if (subCategoryId) {
            return this.prisma.foodPlace.findMany({
                where: { subCategoryId },
                include: { subCategory: true },
            });
        }
        return this.prisma.foodPlace.findMany({
            include: { subCategory: true },
        });
    }

    findOne(id: number) {
        return this.prisma.foodPlace.findUnique({
            where: { id },
            include: { subCategory: true },
        });
    }

    async update(id: number, updateFoodPlaceDto: UpdateFoodPlaceDto) {
        const data: any = { ...updateFoodPlaceDto };

        if (data.subCategoryId !== undefined) {
            const subCatId = typeof data.subCategoryId === 'string' ? parseInt(data.subCategoryId, 10) : data.subCategoryId;
            if (subCatId) {
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

        // Handle numeric and boolean fields from FormData
        if (data.rating !== undefined && typeof data.rating === 'string') data.rating = parseFloat(data.rating);
        if (data.isActive !== undefined && typeof data.isActive === 'string') data.isActive = data.isActive === 'true';

        return this.prisma.foodPlace.update({
            where: { id },
            data: data,
        });
    }

    remove(id: number) {
        return this.prisma.foodPlace.delete({
            where: { id },
        });
    }
}
