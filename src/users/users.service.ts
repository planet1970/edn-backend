import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findOne(email: string): Promise<User | null> {
    return (this.prisma as any).user.findUnique({
      where: { email },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return (this.prisma as any).user.create({
      data,
    });
  }

  async update(id: number, data: Prisma.UserUpdateInput): Promise<User> {
    return (this.prisma as any).user.update({
      where: { id },
      data,
    });
  }

  async findAll(): Promise<User[]> {
    return (this.prisma as any).user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: number): Promise<User> {
    return (this.prisma as any).user.delete({
      where: { id },
    });
  }
}
