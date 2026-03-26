import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    // Neon optimizasyonu - Pool configuration
    const pool = new Pool({
      connectionString,
      max: 2, // VPS ve Serverless icin ideal denge
      idleTimeoutMillis: 30000, // 30 saniye bosta kalirsa kapat
      connectionTimeoutMillis: 2000, // 2 saniye baglanamazsa hata ver
    });

    const adapter = new PrismaNeon(pool);
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to the database');
    } catch (error) {
      this.logger.error('Failed to connect to the database', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}