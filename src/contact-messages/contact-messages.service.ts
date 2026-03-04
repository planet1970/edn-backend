import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContactMessagesService {
    constructor(private prisma: PrismaService) { }

    async create(data: { name: string; email: string; subject?: string; message: string }) {
        return (this.prisma as any).contactMessage.create({
            data,
        });
    }

    async findAll() {
        return (this.prisma as any).contactMessage.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                completedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
    }

    async updateStatus(id: number, status: string, userId: number) {
        return (this.prisma as any).contactMessage.update({
            where: { id },
            data: {
                status,
                completedById: status === 'Tamamlandı' ? userId : null,
            },
            include: {
                completedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
    }
}
