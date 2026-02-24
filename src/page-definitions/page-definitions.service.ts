import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageDefinitionDto } from './dto/create-page-definition.dto';
import { UpdatePageDefinitionDto } from './dto/update-page-definition.dto';
import { PageDefinition } from '@prisma/client';

@Injectable()
export class PageDefinitionsService {
    constructor(private prisma: PrismaService) { }

    async create(createPageDefinitionDto: CreatePageDefinitionDto): Promise<PageDefinition> {
        const { title, description, isActive, dbId, fields } = createPageDefinitionDto;
        const result = await this.prisma.$queryRaw<PageDefinition[]>`
      INSERT INTO "PageDefinition" (title, description, "isActive", "dbId", fields)
      VALUES (${title}, ${description}, ${isActive}, ${dbId}, ${fields})
      RETURNING *;
    `;
        return result[0];
    }

    async findAll(): Promise<PageDefinition[]> {
        return this.prisma.$queryRaw<PageDefinition[]>`
      SELECT * FROM "PageDefinition";
    `;
    }

    async findOne(id: string): Promise<PageDefinition | null> {
        const pageDefinition = await this.prisma.$queryRaw<PageDefinition[]>`
      SELECT * FROM "PageDefinition" WHERE id = ${id};
    `;
        if (!pageDefinition[0]) {
            throw new NotFoundException(`PageDefinition with ID ${id} not found`);
        }
        return pageDefinition[0];
    }

    async update(id: string, updatePageDefinitionDto: UpdatePageDefinitionDto): Promise<PageDefinition> {
        const { title, description, isActive, dbId, fields } = updatePageDefinitionDto;
        const result = await this.prisma.$queryRaw<PageDefinition[]>`
      UPDATE "PageDefinition"
      SET title = ${title}, description = ${description}, "isActive" = ${isActive}, "dbId" = ${dbId}, fields = ${fields}
      WHERE id = ${id}
      RETURNING *;
    `;
        if (!result[0]) {
            throw new NotFoundException(`PageDefinition with ID ${id} not found`);
        }
        return result[0];
    }

    async remove(id: string): Promise<PageDefinition> {
        const result = await this.prisma.$queryRaw<PageDefinition[]>`
      DELETE FROM "PageDefinition"
      WHERE id = ${id}
      RETURNING *;
    `;
        if (!result[0]) {
            throw new NotFoundException(`PageDefinition with ID ${id} not found`);
        }
        return result[0];
    }
}
