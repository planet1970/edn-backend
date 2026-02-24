import { Module } from '@nestjs/common';
import { SplashService } from './splash.service';
import { SplashController } from './splash.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SplashController],
    providers: [SplashService],
})
export class SplashModule { }
