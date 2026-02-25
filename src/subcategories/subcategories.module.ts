import { Module } from '@nestjs/common';
import { SubcategoriesController } from './subcategories.controller';
import { SubcategoriesService } from './subcategories.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../common/upload/upload.module';

@Module({
    imports: [PrismaModule, UploadModule],
    controllers: [SubcategoriesController],
    providers: [SubcategoriesService],
})
export class SubcategoriesModule { }
