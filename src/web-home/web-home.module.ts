
import { Module } from '@nestjs/common';
import { WebHomeService } from './web-home.service';
import { WebHomeController } from './web-home.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [WebHomeController],
    providers: [WebHomeService],
})
export class WebHomeModule { }
