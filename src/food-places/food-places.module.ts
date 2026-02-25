import { Module } from '@nestjs/common';
import { FoodPlacesService } from './food-places.service';
import { FoodPlacesController } from './food-places.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../common/upload/upload.module';

@Module({
    imports: [PrismaModule, UploadModule],
    controllers: [FoodPlacesController],
    providers: [FoodPlacesService],
})
export class FoodPlacesModule { }
