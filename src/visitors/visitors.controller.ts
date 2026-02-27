import { Controller, Post, Get, Body, Param, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../common/upload/upload.service';

@Controller('visitors')
export class VisitorsController {
    constructor(
        private readonly visitorsService: VisitorsService,
        private readonly uploadService: UploadService
    ) { }

    @Post('track')
    async track(@Body() body: { fingerprint: string }, @Req() req: Request) {
        const ip = req.ip;
        const userAgent = req.headers['user-agent'];
        return this.visitorsService.trackVisitor(body.fingerprint, ip, userAgent);
    }

    @Post('upgrade')
    @UseInterceptors(FileInterceptor('file'))
    async upgrade(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: any
    ) {
        let imageUrl = undefined;
        if (file) {
            imageUrl = await this.uploadService.handleFile(file, 'profiles');
        }
        return this.visitorsService.upgradeToUser({
            ...body,
            imageUrl
        });
    }

    @Post('login')
    async login(@Body() body: { email: string, password: string, visitorId: string }) {
        return this.visitorsService.loginUser(body);
    }

    @Get(':fingerprint')
    async get(@Param('fingerprint') fingerprint: string) {
        return this.visitorsService.getVisitor(fingerprint);
    }
}
