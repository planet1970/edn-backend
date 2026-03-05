
import { Module } from '@nestjs/common';
import { TempPagesService } from './temp-pages.service';
import { TempPagesController } from './temp-pages.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [TempPagesService],
    controllers: [TempPagesController],
    exports: [TempPagesService]
})
export class TempPagesModule { }
