import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { FoodPlacesService } from './food-places.service';
import { CreateFoodPlaceDto } from './dto/create-food-place.dto';
import { UpdateFoodPlaceDto } from './dto/update-food-place.dto';
import { multerStorage } from 'src/common/upload/upload.config';
import { UploadService } from 'src/common/upload/upload.service';

@Controller('food-places')
export class FoodPlacesController {
    constructor(
        private readonly foodPlacesService: FoodPlacesService,
        private readonly uploadService: UploadService,
    ) { }

    @Get('test-connection')
    test() {
        return { status: 'ok', message: 'FoodPlacesController is reachable' };
    }

    @Post()
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'file', maxCount: 1 },
        { name: 'back_file', maxCount: 1 }
    ], {
        storage: multerStorage
    }))
    async create(
        @Body() createFoodPlaceDto: CreateFoodPlaceDto,
        @UploadedFiles()
        files: { file?: Express.Multer.File[]; back_file?: Express.Multer.File[] },
    ) {
        const file = files.file?.[0];
        const backFile = files.back_file?.[0];

        if (file) {
            createFoodPlaceDto.imageUrl = await this.uploadService.handleFile(file, 'foods');
        }
        if (backFile) {
            createFoodPlaceDto.backImageUrl = await this.uploadService.handleFile(backFile, 'foods');
        }

        return this.foodPlacesService.create(createFoodPlaceDto);
    }

    @Get()
    findAll(@Query('subCategoryId') subCategoryId?: string) {
        return this.foodPlacesService.findAll(subCategoryId ? +subCategoryId : undefined);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.foodPlacesService.findOne(+id);
    }

    @Patch('reorder')
    reorder(@Body('ids') ids: number[]) {
        return this.foodPlacesService.reorder(ids);
    }

    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'file', maxCount: 1 },
        { name: 'back_file', maxCount: 1 }
    ], {
        storage: multerStorage
    }))
    async update(
        @Param('id') id: string,
        @Body() updateFoodPlaceDto: UpdateFoodPlaceDto,
        @UploadedFiles() files: { file?: Express.Multer.File[], back_file?: Express.Multer.File[] }
    ) {
        const file = files?.file?.[0];
        const backFile = files?.back_file?.[0];
        return this.foodPlacesService.update(+id, updateFoodPlaceDto, file, backFile);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.foodPlacesService.remove(+id);
    }
}
