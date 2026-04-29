import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { UploadService } from '../common/upload/upload.service';

@Injectable()
export class SubcategoriesService {
    constructor(
        private prisma: PrismaService,
        private readonly uploadService: UploadService
    ) { }

    async create(createSubcategoryDto: CreateSubcategoryDto, file?: Express.Multer.File) {
        const data = { ...createSubcategoryDto };
        if (typeof data.isActive === 'string') {
            data.isActive = data.isActive === 'true';
        }

        if (file) {
            data.imageUrl = await this.uploadService.handleFile(file, 'subcategories');
        }

        return this.prisma.subCategory.create({ data });
    }

    async findAll(categoryId?: number) {
        if (categoryId) {
            return this.prisma.subCategory.findMany({ 
                where: { categoryId },
                orderBy: { order: 'asc' }
            });
        }
        return this.prisma.subCategory.findMany({
            orderBy: { order: 'asc' }
        });
    }

    async findOne(id: number) {
        const subcategory = await this.prisma.subCategory.findUnique({ where: { id } });
        if (!subcategory) {
            throw new NotFoundException(`Subcategory with ID ${id} not found`);
        }
        return subcategory;
    }

    async update(id: number, updateSubcategoryDto: UpdateSubcategoryDto, file?: Express.Multer.File) {
        const existingSubcategory = await this.prisma.subCategory.findUnique({ where: { id } });
        if (!existingSubcategory) {
            throw new NotFoundException(`Subcategory with ID ${id} not found`);
        }

        const data = { ...updateSubcategoryDto };
        if (typeof data.isActive === 'string') {
            data.isActive = data.isActive === 'true';
        }

        if (file) {
            data.imageUrl = await this.uploadService.handleFile(file, 'subcategories', existingSubcategory.imageUrl);
        }

        return this.prisma.subCategory.update({
            where: { id },
            data,
        });
    }

    async remove(id: number) {
        const existingSubcategory = await this.prisma.subCategory.findUnique({ where: { id } });
        if (!existingSubcategory) {
            throw new NotFoundException(`Subcategory with ID ${id} not found`);
        }

        if (existingSubcategory.imageUrl) {
            await this.uploadService.deleteFile(existingSubcategory.imageUrl);
        }

        return this.prisma.subCategory.delete({ where: { id } });
    }

    async reorder(ids: number[]) {
        return this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.subCategory.update({
                    where: { id },
                    data: { order: index + 1 },
                })
            )
        );
    }
}
