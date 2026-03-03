import { Module } from '@nestjs/common';
import { PopularPlacesService } from './popular-places.service';
import { PopularPlacesController } from './popular-places.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PopularPlacesController],
    providers: [PopularPlacesService],
    exports: [PopularPlacesService],
})
export class PopularPlacesModule { }
