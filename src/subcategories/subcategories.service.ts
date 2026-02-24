import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

@Injectable()
export class SubcategoriesService {
    constructor(private prisma: PrismaService) { }

    async create(createSubcategoryDto: CreateSubcategoryDto) {
        const data = { ...createSubcategoryDto };
        if (typeof data.isActive === 'string') {
            data.isActive = data.isActive === 'true';
        }
        return this.prisma.subCategory.create({ data });
    }

    async findAll(categoryId?: number) {
        if (categoryId) {
            return this.prisma.subCategory.findMany({ where: { categoryId } });
        }
        return this.prisma.subCategory.findMany();
    }

    async findOne(id: number) {
        const subcategory = await this.prisma.subCategory.findUnique({ where: { id } });
        if (!subcategory) {
            throw new NotFoundException(`Subcategory with ID ${id} not found`);
        }
        return subcategory;
    }

    async update(id: number, updateSubcategoryDto: UpdateSubcategoryDto) {
        const existingSubcategory = await this.prisma.subCategory.findUnique({ where: { id } });
        if (!existingSubcategory) {
            throw new NotFoundException(`Subcategory with ID ${id} not found`);
        }

        const data = { ...updateSubcategoryDto };
        if (typeof data.isActive === 'string') {
            data.isActive = data.isActive === 'true';
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
        return this.prisma.subCategory.delete({ where: { id } });
    }
}
