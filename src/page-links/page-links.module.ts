import { Module } from '@nestjs/common';
import { PageLinksService } from './page-links.service';
import { PageLinksController } from './page-links.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PageLinksController],
    providers: [PageLinksService],
})
export class PageLinksModule { }
