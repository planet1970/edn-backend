import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { PagePlansService } from './page-plans.service';
import { CreatePagePlanDto } from './dto/create-page-plan.dto';
import { UpdatePagePlanDto } from './dto/update-page-plan.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('page-plans')
@Controller('page-plans')
export class PagePlansController {
    constructor(private readonly pagePlansService: PagePlansService) { }

    @Post()
    create(@Body() createPagePlanDto: CreatePagePlanDto) {
        return this.pagePlansService.create(createPagePlanDto);
    }

    @Get()
    findAll() {
        return this.pagePlansService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.pagePlansService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() updatePagePlanDto: UpdatePagePlanDto) {
        return this.pagePlansService.update(id, updatePagePlanDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.pagePlansService.remove(id);
    }
}
