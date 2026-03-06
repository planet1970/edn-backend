import { Module } from '@nestjs/common';
import { PopularPlacesService } from './popular-places.service';
import { PopularPlacesController } from './popular-places.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../common/upload/upload.module';

@Module({
    imports: [PrismaModule, UploadModule],
    controllers: [PopularPlacesController],
    providers: [PopularPlacesService],
    exports: [PopularPlacesService],
})
export class PopularPlacesModule { }
