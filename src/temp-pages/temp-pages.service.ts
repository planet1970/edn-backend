
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TempPagesService {
    constructor(private prisma: PrismaService) { }

    private filterData(data: any, allowedFields: string[]) {
        const cleanData: any = {};
        for (const key of allowedFields) {
            if (data[key] !== undefined) {
                let value = data[key];

                // Handle types based on common field names or value checks
                if (key === 'rating') value = value ? parseFloat(value) : null;
                if (key === 'order' || key === 'categoryId' || key === 'subCategoryId') {
                    value = value ? parseInt(value) : (key === 'subCategoryId' ? 0 : null);
                }
                if (key === 'isActive') value = String(value) === 'true';

                cleanData[key] = value;
            }
        }

        // Ensure subCategoryId is present for FoodPlace
        if (allowedFields.includes('subCategoryId') && !cleanData.subCategoryId && data.subCategoryId) {
            cleanData.subCategoryId = parseInt(data.subCategoryId);
        }

        const originalId = data.id ? parseInt(data.id) : null;
        return { originalId, cleanData };
    }

    async createTempPlace(data: any, userId: number) {
        const allowed = [
            'title', 'slug', 'pic_url', 'back_pic_url', 'icon1', 'title1', 'info1',
            'icon2', 'title2', 'info2', 'icon3', 'title3', 'info3', 'icon4', 'title4', 'info4',
            'description', 'rating', 'panel1_title', 'panel1', 'panel2_title', 'panel2',
            'panel_col_title', 'panel_col', 'panel3_title', 'panel3', 'panel4_title', 'panel4',
            'panel_col_title2', 'panel_col2', 'panel5_title', 'area1', 'area2', 'area3',
            'area4', 'area5', 'area6', 'area7', 'area8', 'area9', 'area10', 'source',
            'order', 'isActive', 'categoryId', 'subCategoryId'
        ];

        try {
            const { originalId, cleanData } = this.filterData(data, allowed);
            console.log("Saving TempPlace draft. Original ID:", originalId, "User ID:", userId);

            return await this.prisma.tempPlace.create({
                data: {
                    ...cleanData,
                    originalId: originalId,
                    updatedById: userId,
                    status: 'PENDING'
                }
            });
        } catch (error) {
            console.error("Prisma error in createTempPlace:", error);
            throw error;
        }
    }

    async createTempFoodPlace(data: any, userId: number) {
        const allowed = [
            'title', 'slug', 'subtitle', 'mainColor', 'imageUrl', 'backImageUrl',
            'campaignUrl', 'badge', 'rating', 'storyTitle', 'description', 'backContent',
            'phone', 'hoursEveryday', 'hoursMon', 'hoursTue', 'hoursWed', 'hoursThu',
            'hoursFri', 'hoursSat', 'hoursSun', 'menuItem1', 'menuItem2', 'menuItem3',
            'menuItem4', 'menuItem5', 'menuItem6', 'menuItem7', 'menuItem8', 'menuItem9',
            'menuItem10', 'menuDesc1', 'menuDesc2', 'menuDesc3', 'menuDesc4', 'menuDesc5',
            'menuDesc6', 'menuDesc7', 'menuDesc8', 'menuDesc9', 'menuDesc10', 'menuPrice1',
            'menuPrice2', 'menuPrice3', 'menuPrice4', 'menuPrice5', 'menuPrice6', 'menuPrice7',
            'menuPrice8', 'menuPrice9', 'menuPrice10', 'features', 'address', 'website',
            'field1', 'field2', 'field3', 'field4', 'field5', 'isActive', 'subCategoryId'
        ];

        try {
            const { originalId, cleanData } = this.filterData(data, allowed);
            console.log("Saving TempFoodPlace draft. Original ID:", originalId, "User ID:", userId);

            // For FoodPlace, subCategoryId is required in schema, so let's make sure it's not null
            if (!cleanData.subCategoryId) {
                // Try to find it in data if it wasn't in allowed (though it is in allowed)
                cleanData.subCategoryId = data.subCategoryId ? parseInt(data.subCategoryId) : 1; // Fallback to 1 if absolutely missing
            }

            return await this.prisma.tempFoodPlace.create({
                data: {
                    ...cleanData,
                    originalId: originalId,
                    updatedById: userId,
                    status: 'PENDING'
                }
            });
        } catch (error) {
            console.error("Prisma error in createTempFoodPlace:", error);
            throw error;
        }
    }

    async getMyDrafts(userId: number) {
        try {
            const places = await this.prisma.tempPlace.findMany({
                where: { updatedById: userId },
                orderBy: { createdAt: 'desc' }
            });
            const foodPlaces = await this.prisma.tempFoodPlace.findMany({
                where: { updatedById: userId },
                orderBy: { createdAt: 'desc' }
            });

            const results = [];

            for (const p of places) {
                results.push({
                    ...p,
                    pageType: 'PLACE'
                });
            }

            for (const f of foodPlaces) {
                results.push({
                    ...f,
                    pageType: 'FOOD_PLACE'
                });
            }

            return results.sort((a, b) => {
                const dateB = new Date(b.createdAt).getTime();
                const dateA = new Date(a.createdAt).getTime();
                return dateB - dateA;
            });
        } catch (error) {
            console.error("Error fetching drafts:", error);
            return [];
        }
    }

    async deleteDraft(id: number, pageType: string) {
        if (pageType === 'PLACE') {
            return await this.prisma.tempPlace.delete({ where: { id: id } });
        } else {
            return await this.prisma.tempFoodPlace.delete({ where: { id: id } });
        }
    }

    async getAllDrafts() {
        try {
            const places = await this.prisma.tempPlace.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    updatedBy: {
                        select: { name: true, username: true }
                    }
                }
            });
            const foodPlaces = await this.prisma.tempFoodPlace.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    updatedBy: {
                        select: { name: true, username: true }
                    }
                }
            });

            const results = [];
            for (const p of places) results.push({ ...p, pageType: 'PLACE' });
            for (const f of foodPlaces) results.push({ ...f, pageType: 'FOOD_PLACE' });

            return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } catch (error) {
            console.error("Error fetching all drafts:", error);
            return [];
        }
    }

    async approveDraft(id: number, pageType: string) {
        if (pageType === 'PLACE') {
            const draft = await this.prisma.tempPlace.findUnique({ where: { id } });
            if (!draft || !draft.originalId) throw new Error("Draft or original record not found");

            const { id: draftId, originalId, createdAt, updatedAt, status, updatedById, createdById, ...updateData } = draft;

            // Update main table
            await this.prisma.place.update({
                where: { id: originalId },
                data: updateData
            });

            // Update draft status
            return await this.prisma.tempPlace.update({
                where: { id: id },
                data: { status: 'APPROVED' }
            });
        } else {
            const draft = await this.prisma.tempFoodPlace.findUnique({ where: { id } });
            if (!draft || !draft.originalId) throw new Error("Draft or original record not found");

            const { id: draftId, originalId, createdAt, updatedAt, status, updatedById, ...updateData } = draft;

            // Update main table
            await this.prisma.foodPlace.update({
                where: { id: originalId },
                data: updateData
            });

            // Update draft status
            return await this.prisma.tempFoodPlace.update({
                where: { id: id },
                data: { status: 'APPROVED' }
            });
        }
    }
}
