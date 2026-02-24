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
}
