import { Controller, Get, Post, Body, Req, Ip, UseGuards, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VisitorsService } from './visitors.service';
import { AuthGuard } from '@nestjs/passport';
import { multerStorage } from '../common/upload/upload.config';
import { UploadService } from '../common/upload/upload.service';

@Controller('visitors')
export class VisitorsController {
    constructor(
        private readonly visitorsService: VisitorsService,
        private readonly uploadService: UploadService
    ) { }

    @Get('test')
    test() {
        return { message: 'Visitors controller is active' };
    }

    @Post('track')
    async trackVisitor(
        @Body() body: { fingerprint: string },
        @Ip() ip: string,
        @Req() req: any
    ) {
        const userAgent = req.headers['user-agent'];
        return this.visitorsService.trackVisitor(body.fingerprint, ip, userAgent);
    }

    @Get(':fingerprint')
    async getVisitor(@Param('fingerprint') fingerprint: string) {
        return this.visitorsService.getVisitor(fingerprint);
    }

    @Post('login')
    async loginUser(@Body() body: any) {
        return this.visitorsService.loginUser(body);
    }

    @Post('upgrade')
    @UseInterceptors(FileInterceptor('file', { storage: multerStorage }))
    async upgradeToUser(
        @Body() body: any,
        @UploadedFile() file: Express.Multer.File
    ) {
        if (file) {
            try {
                body.imageUrl = await this.uploadService.handleFile(file, 'profiles');
            } catch (error) {
                console.error('Profile image upload failed, continuing without image:', error);
            }
        }
        return this.visitorsService.upgradeToUser(body);
    }

    @Post('message')
    async setCustomMessage(@Body() body: { fingerprint: string, message: string }) {
        return this.visitorsService.setCustomMessage(body.fingerprint, body.message);
    }

    @UseGuards(AuthGuard('jwt'))
    @Get()
    findAll() {
        return this.visitorsService.findAll();
    }
}
