import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { Place } from '@prisma/client';
import { UploadService } from '../common/upload/upload.service';

@Injectable()
export class PlacesService {
    constructor(
        private prisma: PrismaService,
        private readonly uploadService: UploadService,
    ) { }

    async create(createPlaceDto: CreatePlaceDto, userId: number, file?: Express.Multer.File, backFile?: Express.Multer.File): Promise<Place> {
        try {
            let pic_url = createPlaceDto.pic_url || null;
            if (file) {
                pic_url = await this.uploadService.handleFile(file, 'places');
            }

            let back_pic_url = createPlaceDto.back_pic_url || null;
            if (backFile) {
                back_pic_url = await this.uploadService.handleFile(backFile, 'places');
            }

            const dataToCreate: any = {
                ...createPlaceDto,
                pic_url,
                back_pic_url,
            };

            // Explicitly convert rating to number and isActive to boolean
            if (dataToCreate.rating !== undefined && typeof dataToCreate.rating === 'string') {
                dataToCreate.rating = parseFloat(dataToCreate.rating);
            }
            if (dataToCreate.isActive !== undefined && typeof dataToCreate.isActive === 'string') {
                dataToCreate.isActive = dataToCreate.isActive === 'true';
            }

            // Handle relations for categoryId and subCategoryId
            if (dataToCreate.categoryId !== undefined) {
                const catId = typeof dataToCreate.categoryId === 'string' ? parseInt(dataToCreate.categoryId, 10) : dataToCreate.categoryId;
                if (catId) {
                    dataToCreate.category = { connect: { id: catId } };
                }
                delete dataToCreate.categoryId;
            }

            if (dataToCreate.subCategoryId !== undefined) {
                const subCatId = typeof dataToCreate.subCategoryId === 'string' ? parseInt(dataToCreate.subCategoryId, 10) : dataToCreate.subCategoryId;
                if (subCatId) {
                    dataToCreate.subCategory = { connect: { id: subCatId } };
                }
                delete dataToCreate.subCategoryId;
            }

            let user = await this.prisma.user.findFirst();
            if (!user) {
                try {
                    user = await this.prisma.user.create({
                        data: {
                            email: 'admin@example.com',
                            password: 'hashed_password_placeholder',
                            name: 'Admin',
                            role: 'ADMIN'
                        }
                    });
                } catch (e) {
                    console.error("Failed to create fallback user", e);
                }
            }

            if (user) {
                dataToCreate.createdBy = { connect: { id: user.id } };
                dataToCreate.updatedBy = { connect: { id: user.id } };
            }

            return await this.prisma.place.create({
                data: dataToCreate,
            });
        } catch (error) {
            console.error('Error creating place:', error);
            throw new InternalServerErrorException('Failed to create place');
        }
    }

    async findAll(slug?: string, subCategoryId?: number): Promise<Place[]> {
        const where: any = {};
        if (slug) where.slug = slug;
        if (subCategoryId) where.subCategoryId = subCategoryId;

        return this.prisma.place.findMany({
            where,
            orderBy: { order: 'asc' } as any
        });
    }

    async findOne(id: number): Promise<Place | null> {
        const place = await this.prisma.place.findUnique({
            where: { id },
        });
        if (!place) {
            throw new NotFoundException(`Place with ID ${id} not found`);
        }
        return place;
    }

    async update(id: number, updatePlaceDto: UpdatePlaceDto, userId: number, file?: Express.Multer.File, backFile?: Express.Multer.File): Promise<Place> {
        const existingPlace = await this.prisma.place.findUnique({ where: { id } });
        if (!existingPlace) {
            throw new NotFoundException(`Place with ID ${id} not found`);
        }

        let pic_url = updatePlaceDto.pic_url || existingPlace.pic_url;
        if (file) {
            pic_url = await this.uploadService.handleFile(file, 'places');
        }

        let back_pic_url = updatePlaceDto.back_pic_url || existingPlace.back_pic_url;
        if (backFile) {
            back_pic_url = await this.uploadService.handleFile(backFile, 'places');
        }

        const dataToUpdate: any = {
            ...updatePlaceDto,
            pic_url,
            back_pic_url,
        };

        // Explicitly convert rating to number and isActive to boolean for update
        if (dataToUpdate.rating !== undefined && typeof dataToUpdate.rating === 'string') {
            dataToUpdate.rating = parseFloat(dataToUpdate.rating);
        }
        if (dataToUpdate.isActive !== undefined && typeof dataToUpdate.isActive === 'string') {
            dataToUpdate.isActive = dataToUpdate.isActive === 'true';
        }
        if (dataToUpdate.order !== undefined && typeof dataToUpdate.order === 'string') {
            dataToUpdate.order = parseInt(dataToUpdate.order, 10);
        }

        if (dataToUpdate.categoryId !== undefined) {
            const catId = typeof dataToUpdate.categoryId === 'string' ? parseInt(dataToUpdate.categoryId, 10) : dataToUpdate.categoryId;
            if (catId) {
                dataToUpdate.category = { connect: { id: catId } };
            }
            delete dataToUpdate.categoryId;
        }

        if (dataToUpdate.subCategoryId !== undefined) {
            const subCatId = typeof dataToUpdate.subCategoryId === 'string' ? parseInt(dataToUpdate.subCategoryId, 10) : dataToUpdate.subCategoryId;
            if (subCatId) {
                dataToUpdate.subCategory = { connect: { id: subCatId } };
            }
            delete dataToUpdate.subCategoryId;
        }

        const user = await this.prisma.user.findFirst();

        if (user) {
            dataToUpdate.updatedBy = { connect: { id: user.id } };
        }

        return this.prisma.place.update({
            where: { id },
            data: dataToUpdate
        });
    }

    async remove(id: number): Promise<Place> {
        const existingPlace = await this.prisma.place.findUnique({ where: { id } });
        if (!existingPlace) {
            throw new NotFoundException(`Place with ID ${id} not found`);
        }
        return this.prisma.place.delete({
            where: { id },
        });
    }
}
