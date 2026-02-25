import { Module } from '@nestjs/common';
import { SplashService } from './splash.service';
import { SplashController } from './splash.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UploadModule } from 'src/common/upload/upload.module';

@Module({
    imports: [PrismaModule, UploadModule],
    controllers: [SplashController],
    providers: [SplashService],
})
export class SplashModule { }
