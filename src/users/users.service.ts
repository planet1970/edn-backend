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
      data: {
        ...data,
        roleId: (data as any).roleId || 'USER',
        isActive: (data as any).isActive ?? true,
      } as any,
    });
  }

  async update(id: number, data: Prisma.UserUpdateInput): Promise<User> {
    return (this.prisma as any).user.update({
      where: { id },
      data,
    });
  }

  async findAll(): Promise<any[]> {
    const users = await (this.prisma as any).user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        role: true,
        visitor: true
      }
    });
    return users.map((user: any) => {
      const mapped = {
        ...user,
        fullName: user.name || '',
        name: user.name || '',
        roleId: user.roleId,
        roleName: user.role?.title || user.roleId,
        visitCount: user.visitor?.visitCount || 0,
        lastVisitAt: user.visitor?.lastVisitAt || null,
        fingerprint: user.visitorId,
        ip: user.visitor?.lastIp || '',
      };
      return mapped;
    });
  }

  async remove(id: number): Promise<User> {
    return (this.prisma as any).user.delete({
      where: { id },
    });
  }

  // UserType methods
  async findAllTypes() {
    return (this.prisma as any).userType.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async createType(data: { id: string, title: string, description?: string, isSystem?: boolean }) {
    return (this.prisma as any).userType.upsert({
      where: { id: data.id || `role_${Date.now()}` },
      update: data,
      create: data,
    });
  }

  async removeType(id: string) {
    return (this.prisma as any).userType.delete({
      where: { id },
    });
  }
}
