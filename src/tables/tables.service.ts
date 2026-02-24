import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TablesService {
    constructor(private prisma: PrismaService) { }

    async getTableNames(): Promise<string[]> {
        const query = `
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';
    `;
        const tables = await this.prisma.$queryRawUnsafe<{ tablename: string }[]>(query);
        return tables.map(t => t.tablename).filter(t => t !== '_prisma_migrations');
    }

    async getTableData(tableName: string): Promise<any[]> {
        const allowedTables = await this.getTableNames();
        if (!allowedTables.includes(tableName)) {
            throw new NotFoundException(`Table '${tableName}' not found or access is restricted.`);
        }

        // This is safe because we've validated the tableName against a whitelist
        return this.prisma[tableName].findMany();
    }

    async getColumns(dbUrl: string, tableName: string): Promise<any> {
        const prisma = new PrismaClient({
            datasources: {
                db: {
                    url: dbUrl,
                },
            },
        });

        try {
            const query = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = '${tableName}';
      `;
            const columns = await prisma.$queryRawUnsafe(query);
            return columns;
        } catch (error) {
            console.error(error);
            throw new Error('Failed to get columns');
        } finally {
            await prisma.$disconnect();
        }
    }
}
