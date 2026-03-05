
import { Module } from '@nestjs/common';
import { PageAuthoritiesService } from './page-authorities.service';
import { PageAuthoritiesController } from './page-authorities.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [PageAuthoritiesService],
    controllers: [PageAuthoritiesController],
    exports: [PageAuthoritiesService]
})
export class PageAuthoritiesModule { }
