import { Controller, Get, Post, Body, Req, Ip, UseGuards, Param } from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('visitors')
export class VisitorsController {
    constructor(private readonly visitorsService: VisitorsService) { }

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
    async upgradeToUser(@Body() body: any) {
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
