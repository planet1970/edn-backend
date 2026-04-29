import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Res, HttpStatus, UploadedFile, UseInterceptors } from '@nestjs/common';
import { SubcategoriesService } from './subcategories.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
// Role enum is removed
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from 'src/common/upload/upload.service';
import { multerStorage } from 'src/common/upload/upload.config';

@ApiBearerAuth()
@ApiTags("subcategories")
@Controller("subcategories")
export class SubcategoriesController {
    constructor(
        private readonly subcategoriesService: SubcategoriesService,
        private readonly uploadService: UploadService,
    ) { }

    @Post()
    @UseGuards(AuthGuard("jwt"), RoleGuard)
    @Roles('ADMIN')
    @UseInterceptors(
        FileInterceptor("file", {
            storage: multerStorage,
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
            },
        })
    )
    async create(
        @UploadedFile() file: Express.Multer.File,
        @Body() createSubcategoryDto: CreateSubcategoryDto,
        @Res() res: Response
    ) {
        try {
            const subcategory = await this.subcategoriesService.create(
                createSubcategoryDto,
                file
            );

            return res.status(HttpStatus.CREATED).json(subcategory);
        } catch (error) {
            return res
                .status(HttpStatus.BAD_REQUEST)
                .json({ message: error.message });
        }
    }

    @Get()
    @ApiQuery({ name: "categoryId", required: false, type: Number })
    async findAll(@Query("categoryId") categoryId?: string) {
        return this.subcategoriesService.findAll(categoryId ? +categoryId : undefined);
    }

    @Get(":id")
    async findOne(@Param("id") id: string) {
        return this.subcategoriesService.findOne(+id);
    }

    @Patch('reorder')
    reorder(@Body('ids') ids: number[]) {
        return this.subcategoriesService.reorder(ids);
    }

    @Patch(":id")
    @UseGuards(AuthGuard("jwt"), RoleGuard)
    @Roles('ADMIN')
    @UseInterceptors(
        FileInterceptor("file", {
            storage: multerStorage,
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
            },
        })
    )
    async update(
        @Param("id") id: string,
        @UploadedFile() file: Express.Multer.File,
        @Body() updateSubcategoryDto: UpdateSubcategoryDto,
        @Res() res: Response
    ) {
        try {
            const subcategory = await this.subcategoriesService.update(
                +id,
                updateSubcategoryDto,
                file
            );
            return res.status(HttpStatus.OK).json(subcategory);
        } catch (error) {
            return res
                .status(HttpStatus.BAD_REQUEST)
                .json({ message: error.message });
        }
    }

    @Delete(":id")
    @UseGuards(AuthGuard("jwt"), RoleGuard)
    @Roles('ADMIN')
    remove(@Param('id') id: string) {
        return this.subcategoriesService.remove(+id);
    }
}
