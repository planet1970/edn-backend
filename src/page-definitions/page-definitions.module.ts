import { Module } from '@nestjs/common';
import { PageDefinitionsService } from './page-definitions.service';
import { PageDefinitionsController } from './page-definitions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PageDefinitionsController],
    providers: [PageDefinitionsService],
    exports: [PageDefinitionsService],
})
export class PageDefinitionsModule { }
