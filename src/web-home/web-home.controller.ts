import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WebHomeService } from './web-home.service';
import { CreateWebHeroDto } from './dto/create-web-hero.dto';
import { UpdateWebHeroDto } from './dto/update-web-hero.dto';
import { UpdateSocialInfoDto } from './dto/update-social-info.dto';
import { UpdateNavbarDto } from './dto/update-navbar.dto';

@Controller('web-home')
export class WebHomeController {
    constructor(private readonly webHomeService: WebHomeService) { }

    @Post('hero')
    @UseInterceptors(FileInterceptor('file'))
    createHero(@Body() createDto: CreateWebHeroDto, @UploadedFile() file: Express.Multer.File) {
        return this.webHomeService.createHero(createDto, file);
    }

    @Get('hero')
    findAllHero() {
        return this.webHomeService.findAllHero();
    }

    @Patch('hero/:id')
    @UseInterceptors(FileInterceptor('file'))
    updateHero(@Param('id') id: string, @Body() updateDto: UpdateWebHeroDto, @UploadedFile() file: Express.Multer.File) {
        return this.webHomeService.updateHero(id, updateDto, file);
    }

    @Delete('hero/:id')
    removeHero(@Param('id') id: string) {
        return this.webHomeService.removeHero(id);
    }

    @Get('social')
    getSocialInfo() {
        return this.webHomeService.getSocialInfo();
    }

    @Post('social')
    updateSocialInfo(@Body() updateDto: UpdateSocialInfoDto) {
        return this.webHomeService.updateSocialInfo(updateDto);
    }

    @Get('navbar')
    getNavbar() {
        return this.webHomeService.getNavbar();
    }

    @Post('navbar')
    @UseInterceptors(FileInterceptor('file'))
    updateNavbar(@Body() updateDto: UpdateNavbarDto, @UploadedFile() file: Express.Multer.File) {
        console.log('Controller received body:', updateDto);
        return this.webHomeService.updateNavbar(updateDto, file);
    }

    // --- STORY ADS ---

    @Get('ads/story')
    findAllStoryAds() {
        return this.webHomeService.findAllStoryAds();
    }

    @Post('ads/story')
    createStoryAd(@Body() dto: any) {
        return this.webHomeService.createStoryAd(dto);
    }

    @Patch('ads/story/:id')
    updateStoryAd(@Param('id') id: string, @Body() dto: any) {
        return this.webHomeService.updateStoryAd(Number(id), dto);
    }

    @Delete('ads/story/:id')
    removeStoryAd(@Param('id') id: string) {
        return this.webHomeService.removeStoryAd(Number(id));
    }

    @Post('ads/story/reorder')
    reorderStoryAds(@Body() ids: number[]) {
        return this.webHomeService.reorderStoryAds(ids);
    }

    // --- FEATURED ADS ---

    @Get('ads/featured')
    findAllFeaturedAds() {
        return this.webHomeService.findAllFeaturedAds();
    }

    @Post('ads/featured')
    createFeaturedAd(@Body() dto: any) {
        return this.webHomeService.createFeaturedAd(dto);
    }

    @Patch('ads/featured/:id')
    updateFeaturedAd(@Param('id') id: string, @Body() dto: any) {
        return this.webHomeService.updateFeaturedAd(Number(id), dto);
    }

    @Delete('ads/featured/:id')
    removeFeaturedAd(@Param('id') id: string) {
        return this.webHomeService.removeFeaturedAd(Number(id));
    }

    @Post('ads/featured/reorder')
    reorderFeaturedAds(@Body() ids: number[]) {
        return this.webHomeService.reorderFeaturedAds(ids);
    }
}
