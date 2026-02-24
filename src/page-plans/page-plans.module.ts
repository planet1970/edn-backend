import { Module } from '@nestjs/common';
import { PagePlansService } from './page-plans.service';
import { PagePlansController } from './page-plans.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PagePlansController],
    providers: [PagePlansService],
    exports: [PagePlansService],
})
export class PagePlansModule { }
