import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePagePlanDto } from './dto/create-page-plan.dto';
import { UpdatePagePlanDto } from './dto/update-page-plan.dto';
import { PagePlan } from '@prisma/client';

@Injectable()
export class PagePlansService {
    constructor(private prisma: PrismaService) { }

    async create(createPagePlanDto: CreatePagePlanDto): Promise<PagePlan> {
        return this.prisma.pagePlan.create({
            data: createPagePlanDto,
        });
    }

    async findAll(): Promise<PagePlan[]> {
        return this.prisma.pagePlan.findMany({
            include: { category: true, subCategory: true },
        });
    }

    async findOne(id: string): Promise<PagePlan | null> {
        const pagePlan = await this.prisma.pagePlan.findUnique({
            where: { id },
            include: { category: true, subCategory: true },
        });
        if (!pagePlan) {
            throw new NotFoundException(`PagePlan with ID ${id} not found`);
        }
        return pagePlan;
    }

    async update(id: string, updatePagePlanDto: UpdatePagePlanDto): Promise<PagePlan> {
        const existingPagePlan = await this.prisma.pagePlan.findUnique({ where: { id } });
        if (!existingPagePlan) {
            throw new NotFoundException(`PagePlan with ID ${id} not found`);
        }
        return this.prisma.pagePlan.update({
            where: { id },
            data: updatePagePlanDto,
        });
    }

    async remove(id: string): Promise<PagePlan> {
        const existingPagePlan = await this.prisma.pagePlan.findUnique({ where: { id } });
        if (!existingPagePlan) {
            throw new NotFoundException(`PagePlan with ID ${id} not found`);
        }
        return this.prisma.pagePlan.delete({
            where: { id },
        });
    }
}
