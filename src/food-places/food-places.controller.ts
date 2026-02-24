import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { FoodPlacesService } from './food-places.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CreateFoodPlaceDto } from './dto/create-food-place.dto';
import { UpdateFoodPlaceDto } from './dto/update-food-place.dto';

@Controller('food-places')
export class FoodPlacesController {
    constructor(private readonly foodPlacesService: FoodPlacesService) { }

    @Post()
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'file', maxCount: 1 },
        { name: 'back_file', maxCount: 1 }
    ], {
        storage: diskStorage({
            destination: './uploads/foods',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
            }
        })
    }))
    create(
        @Body() createFoodPlaceDto: CreateFoodPlaceDto,
        @UploadedFiles() files: { file?: Express.Multer.File[], back_file?: Express.Multer.File[] }
    ) {
        if (files.file) createFoodPlaceDto.imageUrl = `/uploads/foods/${files.file[0].filename}`;
        if (files.back_file) createFoodPlaceDto.backImageUrl = `/uploads/foods/${files.back_file[0].filename}`;
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

    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'file', maxCount: 1 },
        { name: 'back_file', maxCount: 1 }
    ], {
        storage: diskStorage({
            destination: './uploads/foods',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
            }
        })
    }))
    update(
        @Param('id') id: string,
        @Body() updateFoodPlaceDto: UpdateFoodPlaceDto,
        @UploadedFiles() files: { file?: Express.Multer.File[], back_file?: Express.Multer.File[] }
    ) {
        if (files?.file) updateFoodPlaceDto.imageUrl = `/uploads/foods/${files.file[0].filename}`;
        if (files?.back_file) updateFoodPlaceDto.backImageUrl = `/uploads/foods/${files.back_file[0].filename}`;
        return this.foodPlacesService.update(+id, updateFoodPlaceDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.foodPlacesService.remove(+id);
    }
}
