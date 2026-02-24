import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) { }

  findAll() {
    return this.prisma.category.findMany({
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadı');
    return category;
  }

  async create(data: CreateCategoryDto) {
    // Re-index all categories to ensure no gaps or duplicates before adding new one
    await this.reIndexCategories();

    const nextOrder = data.order ?? (await this.getNextOrder());
    let isActive = data.isActive;
    if (typeof isActive === 'string') {
      isActive = isActive === 'true';
    }
    return this.prisma.category.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim(),
        iconName: data.iconName?.trim(),
        webIcon: data.webIcon?.trim(),
        order: nextOrder,
        isActive: isActive ?? true,
      },
    });
  }

  async update(id: number, data: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kategori bulunamadı');

    let isActive = data.isActive;
    if (typeof isActive === 'string') {
      isActive = isActive === 'true';
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        title: data.title?.trim(),
        description: data.description?.trim(),
        iconName: data.iconName?.trim(),
        webIcon: data.webIcon?.trim(),
        order: data.order,
        isActive: isActive,
      },
    });

    // Re-index to ensure no gaps or duplicates if order was manually changed or just to be safe
    await this.reIndexCategories();
    return updated;
  }

  async remove(id: number) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kategori bulunamadı');
    await this.prisma.category.delete({ where: { id } });

    // After deletion, re-index to fill the gap
    await this.reIndexCategories();
    return { success: true };
  }

  // Renumber existing categories to be 1, 2, 3... based on current order
  private async reIndexCategories() {
    const all = await this.prisma.category.findMany({
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    for (let i = 0; i < all.length; i++) {
      if (all[i].order !== i + 1) {
        await this.prisma.category.update({
          where: { id: all[i].id },
          data: { order: i + 1 }
        });
      }
    }
  }

  private async getNextOrder(): Promise<number> {
    const count = await this.prisma.category.count();
    return count + 1;
  }
}
