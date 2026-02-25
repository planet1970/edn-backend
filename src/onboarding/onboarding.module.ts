import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UploadModule } from 'src/common/upload/upload.module';

@Module({
    imports: [PrismaModule, UploadModule],
    controllers: [OnboardingController],
    providers: [OnboardingService],
})
export class OnboardingModule { }
