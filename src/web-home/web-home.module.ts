
import { Module } from '@nestjs/common';
import { WebHomeService } from './web-home.service';
import { WebHomeController } from './web-home.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadModule } from '../common/upload/upload.module';

@Module({
    imports: [PrismaModule, UploadModule],
    controllers: [WebHomeController],
    providers: [WebHomeService],
})
export class WebHomeModule { }
