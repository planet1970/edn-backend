import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('stats')
export class StatsController {
    constructor(private readonly statsService: StatsService) { }

    @UseGuards(AuthGuard('jwt'))
    @Get('dashboard')
    getDashboardStats() {
        return this.statsService.getDashboardStats();
    }
}
