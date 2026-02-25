import { Module } from '@nestjs/common';
import { PlacesService } from './places.service';
import { PlacesController } from './places.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../common/upload/upload.module';

@Module({
    imports: [PrismaModule, UploadModule],
    controllers: [PlacesController],
    providers: [PlacesService],
})
export class PlacesModule { }
