import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseInterceptors, UploadedFile, Query, UploadedFiles } from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { PlacesService } from './places.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('places')
@Controller('places')
export class PlacesController {
    constructor(private readonly placesService: PlacesService) { }

    @Post()
    @UseInterceptors(AnyFilesInterceptor())
    create(@Body() createPlaceDto: CreatePlaceDto, @UploadedFiles() files: Express.Multer.File[]) {
        // TODO: Implement get current user id from request
        const userId = 1;
        const file = files?.find(f => f.fieldname === 'file');
        const backFile = files?.find(f => f.fieldname === 'back_file');
        return this.placesService.create(createPlaceDto, userId, file, backFile);
    }

    @Get()
    findAll(@Query('slug') slug?: string, @Query('subCategoryId') subCategoryId?: string) {
        const subCatId = subCategoryId ? parseInt(subCategoryId, 10) : undefined;
        return this.placesService.findAll(slug, subCatId);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.placesService.findOne(id);
    }

    @Patch(':id')
    @UseInterceptors(AnyFilesInterceptor())
    update(@Param('id', ParseIntPipe) id: number, @Body() updatePlaceDto: UpdatePlaceDto, @UploadedFiles() files: Express.Multer.File[]) {
        // TODO: Implement get current user id from request
        const userId = 1;
        const file = files?.find(f => f.fieldname === 'file');
        const backFile = files?.find(f => f.fieldname === 'back_file');
        return this.placesService.update(id, updatePlaceDto, userId, file, backFile);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.placesService.remove(id);
    }
}
