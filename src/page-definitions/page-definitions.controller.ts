import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { PageDefinitionsService } from './page-definitions.service';
import { CreatePageDefinitionDto } from './dto/create-page-definition.dto';
import { UpdatePageDefinitionDto } from './dto/update-page-definition.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('page-definitions')
@Controller('page-definitions')
export class PageDefinitionsController {
    constructor(private readonly pageDefinitionsService: PageDefinitionsService) { }

    @Post()
    create(@Body() createPageDefinitionDto: CreatePageDefinitionDto) {
        return this.pageDefinitionsService.create(createPageDefinitionDto);
    }

    @Get()
    findAll() {
        return this.pageDefinitionsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.pageDefinitionsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() updatePageDefinitionDto: UpdatePageDefinitionDto) {
        return this.pageDefinitionsService.update(id, updatePageDefinitionDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.pageDefinitionsService.remove(id);
    }
}
