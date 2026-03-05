
import { Controller, Get, Post, Delete, Body, Param, UseGuards, ParseIntPipe, Query } from '@nestjs/common';
import { PageAuthoritiesService } from './page-authorities.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('page-authorities')
@Controller('page-authorities')
export class PageAuthoritiesController {
    constructor(private readonly service: PageAuthoritiesService) { }

    @Get('customers')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Müşteri listesi' })
    async getCustomers() {
        return this.service.getCustomers();
    }

    @Get('assigned-customers')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Yetkilendirilmiş müşteri listesi (Simülasyon için)' })
    async getAssignedCustomers() {
        return this.service.getAssignedCustomers();
    }

    @Get(':type/:id')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Sayfa yetkililerini listele' })
    async getAuthorities(
        @Param('type') type: string,
        @Param('id', ParseIntPipe) id: number
    ) {
        return this.service.getAuthorities(type, id);
    }

    @Post()
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Yetkili ekle' })
    async addAuthority(@Body() body: { sourceType: string, sourceId: number, userId: number }) {
        return this.service.addAuthority(body.sourceType, body.sourceId, body.userId);
    }

    @Delete(':id')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Yetkili sil' })
    async removeAuthority(@Param('id', ParseIntPipe) id: number) {
        return this.service.removeAuthority(id);
    }
}
