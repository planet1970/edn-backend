import { Module } from '@nestjs/common';
import { FoodPlacesService } from './food-places.service';
import { FoodPlacesController } from './food-places.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [FoodPlacesController],
    providers: [FoodPlacesService],
})
export class FoodPlacesModule { }
