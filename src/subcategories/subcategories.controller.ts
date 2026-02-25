import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Res, HttpStatus, UploadedFile, UseInterceptors } from '@nestjs/common';
import { SubcategoriesService } from './subcategories.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
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
    @Roles(Role.ADMIN, Role.EXAM_OFFICER)
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
            if (file) {
                createSubcategoryDto.imageUrl = await this.uploadService.handleFile(
                    file,
                    "subcategories"
                );
            }

            const subcategory = await this.subcategoriesService.create(
                createSubcategoryDto
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

    @Patch(":id")
    @UseGuards(AuthGuard("jwt"), RoleGuard)
    @Roles(Role.ADMIN, Role.EXAM_OFFICER)
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
            if (file) {
                updateSubcategoryDto.imageUrl = await this.uploadService.handleFile(
                    file,
                    "subcategories"
                );
            }
            const subcategory = await this.subcategoriesService.update(
                +id,
                updateSubcategoryDto
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
    @Roles(Role.ADMIN, Role.EXAM_OFFICER)
    async remove(@Param("id") id: string) {
        return this.subcategoriesService.remove(+id);
    }
}
