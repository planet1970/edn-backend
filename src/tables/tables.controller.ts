import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { TablesService } from './tables.service';

@Controller('tables')
export class TablesController {
    constructor(private readonly tablesService: TablesService) { }

    @Get()
    getTableNames() {
        return this.tablesService.getTableNames();
    }

    @Get(':name')
    getTableData(@Param('name') name: string) {
        return this.tablesService.getTableData(name);
    }

    @Post('columns')
    getColumns(@Body() body: { dbUrl: string, tableName: string }) {
        return this.tablesService.getColumns(body.dbUrl, body.tableName);
    }
}
