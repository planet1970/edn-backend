import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseInterceptors, UploadedFile, Res, HttpStatus } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
    constructor(private readonly onboardingService: OnboardingService) { }

    @Get()
    findAll() {
        return this.onboardingService.findAll();
    }

    @Post()
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './uploads/main',
                filename: (req, file, cb) => {
                    const randomName = uuid();
                    cb(null, `${randomName}${extname(file.originalname)}`);
                },
            }),
        }),
    )
    async create(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: any,
        @Res() res: Response,
    ) {
        try {
            const data = {
                title: body.title,
                description: body.description,
                imageUrl: body.imageUrl,
                icon: body.icon,
                order: body.order ? parseInt(body.order, 10) : 0,
            };

            if (file) {
                data.imageUrl = `/uploads/main/${file.filename}`;
            }

            const result = await this.onboardingService.create(data);
            return res.status(HttpStatus.CREATED).json(result);
        } catch (error) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: error.message });
        }
    }

    @Put(':id')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './uploads/main',
                filename: (req, file, cb) => {
                    const randomName = uuid();
                    cb(null, `${randomName}${extname(file.originalname)}`);
                },
            }),
        }),
    )
    async update(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: any,
        @Res() res: Response,
    ) {
        try {
            const data: any = {
                title: body.title,
                description: body.description,
                icon: body.icon,
                order: body.order ? parseInt(body.order, 10) : undefined,
            };

            if (body.imageUrl) {
                data.imageUrl = body.imageUrl;
            }

            if (file) {
                data.imageUrl = `/uploads/main/${file.filename}`;
            }

            const result = await this.onboardingService.update(id, data);
            return res.status(HttpStatus.OK).json(result);
        } catch (error) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: error.message });
        }
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.onboardingService.remove(id);
    }
}
