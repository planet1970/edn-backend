import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
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

    // --- GOOGLE ADS ---

    @Get('ads/google')

    findAllGoogleAds() {
        return this.webHomeService.findAllGoogleAds();
    }

    @Patch('ads/google/:areaName')
    @UseInterceptors(FileInterceptor('file'))
    updateGoogleAd(@Param('areaName') areaName: string, @Body() dto: any, @UploadedFile() file: Express.Multer.File) {
        return this.webHomeService.updateGoogleAd(areaName, dto, file);
    }

    @Delete('ads/google/:areaName')
    removeGoogleAd(@Param('areaName') areaName: string) {
        return this.webHomeService.removeGoogleAd(areaName);
    }

    // --- POPUP ADS ---

    @Get('ads/popup')
    getPopupAds() {
        return this.webHomeService.getPopupAds();
    }

    @Get('ads/popup/active')

    getActivePopupAd() {
        return this.webHomeService.getActivePopupAd();
    }

    @Post('ads/popup')
    @UseInterceptors(FileInterceptor('file'))
    createPopupAd(@Body() dto: any, @UploadedFile() file: Express.Multer.File) {
        return this.webHomeService.createPopupAd(dto, file);
    }

    @Patch('ads/popup/:id')
    @UseInterceptors(FileInterceptor('file'))
    updatePopupAd(@Param('id') id: string, @Body() dto: any, @UploadedFile() file: Express.Multer.File) {
        return this.webHomeService.updatePopupAd(Number(id), dto, file);
    }

    @Delete('ads/popup/:id')
    removePopupAd(@Param('id') id: string) {
        return this.webHomeService.removePopupAd(Number(id));
    }

    @Patch('ads/popup/:id/view')
    incrementPopupView(@Param('id') id: string) {
        return this.webHomeService.incrementPopupView(Number(id));
    }

    @Get('ads/popup-default')
    getDefaultPopupAd() {
        return this.webHomeService.getDefaultPopupAd();
    }

    @Patch('ads/popup-default')
    @UseInterceptors(FileInterceptor('file'))
    updateDefaultPopupAd(@Body() dto: any, @UploadedFile() file: Express.Multer.File) {
        return this.webHomeService.updateDefaultPopupAd(dto, file);
    }

    // --- POPULAR ADS ---

    @Get('ads/popular')

    findAllPopularAds() {
        return this.webHomeService.findAllPopularAds();
    }

    @Post('ads/popular')
    createPopularAd(@Body() dto: any) {
        return this.webHomeService.createPopularAd(dto);
    }

    @Patch('ads/popular/:id')
    updatePopularAd(@Param('id') id: string, @Body() dto: any) {
        return this.webHomeService.updatePopularAd(Number(id), dto);
    }

    @Delete('ads/popular/:id')
    removePopularAd(@Param('id') id: string) {
        return this.webHomeService.removePopularAd(Number(id));
    }

    @Post('ads/popular/reorder')
    reorderPopularAds(@Body() ids: number[]) {
        return this.webHomeService.reorderPopularAds(ids);
    }

    // --- ABOUT SECTION ---

    @Get('about')

    getAboutSection() {
        return this.webHomeService.getAboutSection();
    }

    @Post('about')
    updateAboutSection(@Body() dto: any) {
        return this.webHomeService.updateAboutSection(dto);
    }

    @Post('about/cards')
    createAboutCard(@Body() dto: any) {
        return this.webHomeService.createAboutCard(dto);
    }

    @Patch('about/cards/:id')
    updateAboutCard(@Param('id') id: string, @Body() dto: any) {
        return this.webHomeService.updateAboutCard(Number(id), dto);
    }

    @Delete('about/cards/:id')
    removeAboutCard(@Param('id') id: string) {
        return this.webHomeService.removeAboutCard(Number(id));
    }

    @Post('about/cards/reorder')
    reorderAboutCards(@Body() ids: number[]) {
        return this.webHomeService.reorderAboutCards(ids);
    }

    // --- GOOGLE NEWS ---

    @Get('news')

    getEdirneNews() {
        return this.webHomeService.getEdirneNews();
    }

    // --- NEWS MANAGEMENT ADMIN ---

    @Get('news-settings')
    getNewsSettings() {
        return this.webHomeService.getNewsSettings();
    }

    @Post('news-settings')
    updateNewsSettings(@Body() dto: { isActive: boolean }) {
        return this.webHomeService.updateNewsSettings(dto.isActive);
    }

    @Get('news-items')
    getAllNewsItems() {
        return this.webHomeService.getAllNewsItems();
    }

    @Post('news-items')
    createManualNews(@Body() dto: { title: string, source: string, link: string, contentSnippet?: string }) {
        return this.webHomeService.createManualNews(dto);
    }

    @Patch('news-items/:id/toggle')
    toggleNewsItem(@Param('id') id: string, @Body() dto: { isActive: boolean }) {
        return this.webHomeService.toggleNewsItem(Number(id), dto.isActive);
    }

    @Delete('news-items/:id')
    deleteNewsItem(@Param('id') id: string) {
        return this.webHomeService.deleteNewsItem(Number(id));
    }
}
