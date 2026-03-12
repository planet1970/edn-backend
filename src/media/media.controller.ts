import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('media')
@UseGuards(AuthGuard('jwt'), RoleGuard)
@Roles('ADMIN')
export class MediaController {
    constructor(private readonly cloudinaryService: CloudinaryService) { }

    @Get('list')
    async listMedia() {
        return this.cloudinaryService.listResources();
    }

    @Get('stats')
    async getStats() {
        return this.cloudinaryService.getStats();
    }

    @Delete(':publicId(*)')
    async deleteMedia(@Param('publicId') publicId: string) {
        return this.cloudinaryService.deleteImage(publicId);
    }
}
