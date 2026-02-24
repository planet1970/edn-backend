import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log: ['info', 'warn', 'error'], // Log seviyeleri
    });
  }

  async onModuleInit() {
    // Fix: Cast to any to access $connect which might be missing in generated types
    await (this as any).$connect();
  }

  async onModuleDestroy() {
    // Fix: Cast to any to access $disconnect which might be missing in generated types
    await (this as any).$disconnect();
  }
}