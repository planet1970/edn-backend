
import { Controller, Post, Get, Body, Param, UseGuards, UnauthorizedException, Delete, Patch } from '@nestjs/common';
import { TempPagesService } from './temp-pages.service';

@Controller('temp-pages')
export class TempPagesController {
    constructor(private readonly tempPagesService: TempPagesService) { }

    @Post('place/:userId')
    async savePlaceDraft(@Param('userId') userId: string, @Body() data: any) {
        return this.tempPagesService.createTempPlace(data, parseInt(userId));
    }

    @Post('food-place/:userId')
    async saveFoodPlaceDraft(@Param('userId') userId: string, @Body() data: any) {
        return this.tempPagesService.createTempFoodPlace(data, parseInt(userId));
    }

    @Get('my-drafts/:userId')
    async getMyDrafts(@Param('userId') userId: string) {
        return this.tempPagesService.getMyDrafts(parseInt(userId));
    }

    @Get('all')
    async getAllDrafts() {
        return this.tempPagesService.getAllDrafts();
    }

    @Delete(':pageType/:id')
    async deleteDraft(@Param('pageType') pageType: string, @Param('id') id: string) {
        return this.tempPagesService.deleteDraft(parseInt(id), pageType);
    }

    @Patch('approve/:pageType/:id')
    async approveDraft(@Param('pageType') pageType: string, @Param('id') id: string) {
        return this.tempPagesService.approveDraft(parseInt(id), pageType);
    }
}
