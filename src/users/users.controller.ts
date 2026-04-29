import { Controller, Post, Get, Patch, Delete, UseInterceptors, UploadedFile, UseGuards, Req, HttpStatus, Res, Param, ParseIntPipe, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UploadService } from '../common/upload/upload.service';
// Roles are passed as strings now

@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly uploadService: UploadService
    ) { }

    @Get()
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tüm kullanıcıları listele (Admin)' })
    async findAll() {
        return this.usersService.findAll();
    }

    @Delete(':id')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Kullanıcı sil (Admin)' })
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.remove(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Kullanıcı güncelle (Admin)' })
    async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        return this.usersService.update(id, body);
    }

    @Patch('profile')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Profil bilgilerini güncelle' })
    async updateProfile(@Req() req: any, @Body() body: any) {
        const userId = req.user.userId;
        // Basic validation: prevent changing sensitive fields like role or email via this endpoint if needed
        delete body.role;
        delete body.email;
        return this.usersService.update(userId, body);
    }

    @Post('avatar')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @UseInterceptors(FileInterceptor('file'))
    @ApiOperation({ summary: 'Profil resmi yükle' })
    async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Req() req: any, @Res() res: Response) {
        if (!file) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Dosya yüklenemedi.' });
        }

        const userId = req.user.userId;
        const existing = await this.usersService.findOneById(userId);
        
        const imageUrl = await this.uploadService.handleFile(file, 'users', existing?.imageUrl);

        await this.usersService.update(userId, { imageUrl });

        return res.status(HttpStatus.OK).json({ imageUrl });
    }

    // UserType Endpoints
    @Get('types')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    async findAllTypes() {
        return this.usersService.findAllTypes();
    }

    @Post('types')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    async createType(@Body() body: any) {
        return this.usersService.createType(body);
    }

    @Delete('types/:id')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    async removeType(@Param('id') id: string) {
        return this.usersService.removeType(id);
    }
}
