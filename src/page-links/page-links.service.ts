import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageLinkDto } from './dto/create-page-link.dto';
import { UpdatePageLinkDto } from './dto/update-page-link.dto';

@Injectable()
export class PageLinksService {
    constructor(private prisma: PrismaService) { }

    create(createPageLinkDto: CreatePageLinkDto) {
        return this.prisma.pageLink.create({
            data: createPageLinkDto,
        });
    }

    findAll() {
        return this.prisma.pageLink.findMany();
    }

    findOne(id: number) {
        return this.prisma.pageLink.findUnique({
            where: { id },
        });
    }

    update(id: number, updatePageLinkDto: UpdatePageLinkDto) {
        return this.prisma.pageLink.update({
            where: { id },
            data: updatePageLinkDto,
        });
    }

    remove(id: number) {
        return this.prisma.pageLink.delete({
            where: { id },
        });
    }
}
