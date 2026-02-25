import { Controller, Get, Put, Body, UseInterceptors, UploadedFile, Res, HttpStatus } from '@nestjs/common';
import { SplashService } from './splash.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { UploadService } from 'src/common/upload/upload.service';
import { multerStorage } from 'src/common/upload/upload.config';

@ApiTags('splash')
@Controller('splash')
export class SplashController {
    constructor(
        private readonly splashService: SplashService,
        private readonly uploadService: UploadService,
    ) { }

    @Get()
    async findOne() {
        return this.splashService.find();
    }

    @Put()
    @UseInterceptors(
        FileInterceptor('file', {
            storage: multerStorage,
        }),
    )
    async update(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: any,
        @Res() res: Response,
    ) {
        try {
            const data = {
                backgroundColor: body.backgroundColor,
                duration: body.duration ? parseInt(body.duration, 10) : undefined,
                tagline: body.tagline,
                logoUrl: body.logoUrl,
            };

            if (file) {
                data.logoUrl = await this.uploadService.handleFile(file, 'main');
            }

            const result = await this.splashService.update(data);
            return res.status(HttpStatus.OK).json(result);
        } catch (error) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: error.message });
        }
    }
}
