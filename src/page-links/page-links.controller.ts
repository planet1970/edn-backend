import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { PageLinksService } from './page-links.service';
import { CreatePageLinkDto } from './dto/create-page-link.dto';
import { UpdatePageLinkDto } from './dto/update-page-link.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('page-links')
@Controller('page-links')
export class PageLinksController {
    constructor(private readonly pageLinksService: PageLinksService) { }

    @Post()
    create(@Body() createPageLinkDto: CreatePageLinkDto) {
        return this.pageLinksService.create(createPageLinkDto);
    }

    @Get()
    findAll() {
        return this.pageLinksService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.pageLinksService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updatePageLinkDto: UpdatePageLinkDto) {
        return this.pageLinksService.update(id, updatePageLinkDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.pageLinksService.remove(id);
    }
}
