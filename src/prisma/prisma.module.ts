import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Global yaparak her modülde tekrar import etme zorunluluğunu kaldırıyoruz
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
