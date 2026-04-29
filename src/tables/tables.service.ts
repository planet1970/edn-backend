import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TablesService {
    constructor(private prisma: PrismaService) { }

    async getTableNames(): Promise<string[]> {
        try {
            // First try to get from schema.prisma for better compatibility
            const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
            if (fs.existsSync(schemaPath)) {
                const schema = fs.readFileSync(schemaPath, 'utf8');
                const models = schema.match(/model\s+(\w+)\s+{/g)?.map(m => m.split(/\s+/)[1]) || [];
                if (models.length > 0) {
                    return models.sort();
                }
            }
        } catch (error) {
            console.error('Error reading schema.prisma:', error);
        }

        // Fallback to DB query if schema parsing fails
        try {
            const query = `
                SELECT tablename
                FROM pg_catalog.pg_tables
                WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';
            `;
            const tables = await this.prisma.$queryRawUnsafe<{ tablename: string }[]>(query);
            return tables.map(t => t.tablename).filter(t => t !== '_prisma_migrations').sort();
        } catch (error) {
            console.error('Error querying table names:', error);
            // Return a minimal set of known tables if everything fails
            return ['User', 'Category', 'Place', 'WebNavbar'].sort();
        }
    }

    async getTableData(tableName: string): Promise<any[]> {
        const allowedTables = await this.getTableNames();
        if (!allowedTables.includes(tableName)) {
            throw new NotFoundException(`Table '${tableName}' not found or access is restricted.`);
        }

        // Convert ModelName to prisma property name (e.g. WebNavbar -> webNavbar)
        const prismaModelName = tableName.charAt(0).toLowerCase() + tableName.slice(1);

        if (!this.prisma[prismaModelName]) {
            // Try as-is if camelCase conversion didn't find it
            if (this.prisma[tableName]) {
                return this.prisma[tableName].findMany();
            }
            throw new NotFoundException(`Prisma model for '${tableName}' not found.`);
        }

        return this.prisma[prismaModelName].findMany();
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
