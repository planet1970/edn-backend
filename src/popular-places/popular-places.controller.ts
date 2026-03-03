import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PopularPlacesService } from './popular-places.service';

@Controller('popular-places')
export class PopularPlacesController {
    constructor(private readonly popularPlacesService: PopularPlacesService) { }

    @Get()
    findAll() {
        return this.popularPlacesService.findAll();
    }

    @Get('active')
    findActive() {
        return this.popularPlacesService.findActive();
    }

    @Post()
    create(@Body() dto: any) {
        return this.popularPlacesService.create(dto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: any) {
        return this.popularPlacesService.update(Number(id), dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.popularPlacesService.remove(Number(id));
    }

    @Post('reorder')
    reorder(@Body() ids: number[]) {
        return this.popularPlacesService.reorder(ids);
    }
}
