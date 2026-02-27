
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class VisitorsService {
    constructor(private prisma: PrismaService) { }

    async trackVisitor(fingerprint: string, ip?: string, userAgent?: string) {
        let visitor = await this.prisma.visitor.findUnique({
            where: { fingerprint },
        });

        if (visitor) {
            const updatedVisitor = await this.prisma.visitor.update({
                where: { fingerprint },
                data: {
                    lastIp: ip,
                    userAgent,
                    lastVisitAt: new Date(),
                    visitCount: { increment: 1 },
                },
            });

            // If visitor is linked to a user, merge user data
            const user = await this.prisma.user.findUnique({ where: { visitorId: fingerprint } });
            if (user) {
                return {
                    ...updatedVisitor,
                    username: user.username || updatedVisitor.username,
                    name: user.name,
                    imageUrl: user.imageUrl,
                    email: user.email
                };
            }
            return updatedVisitor;
        } else {
            // Generate a unique EDN-XXXX username
            let username = '';
            let isUnique = false;
            while (!isUnique) {
                const randomId = Math.floor(1000 + Math.random() * 9000); // 4 digits
                username = `EDN-${randomId}`;
                const existingName = await this.prisma.visitor.findUnique({ where: { username } });
                if (!existingName) isUnique = true;
            }

            return this.prisma.visitor.create({
                data: {
                    fingerprint,
                    username,
                    lastIp: ip,
                    userAgent,
                    visitCount: 1,
                },
            });
        }
    }

    async getVisitor(fingerprint: string) {
        const visitor = await this.prisma.visitor.findUnique({
            where: { fingerprint },
        });

        if (visitor) {
            // Check if there's a user linked to this visitor
            const user = await this.prisma.user.findUnique({
                where: { visitorId: fingerprint }
            });

            if (user) {
                return {
                    ...visitor,
                    email: user.email,
                    username: user.username,
                    name: user.name,
                    phone: user.phone,
                    imageUrl: user.imageUrl,
                    isEdirnelim: user.isEdirnelim
                };
            }
        }
        return visitor;
    }

    async loginUser(data: { email: string, password: string, visitorId: string }) {
        const user = await this.prisma.user.findUnique({ where: { email: data.email } });
        if (!user || !user.password) {
            throw new UnauthorizedException('E-posta veya şifre hatalı.');
        }

        const isMatch = await bcrypt.compare(data.password, user.password);
        if (!isMatch) {
            throw new UnauthorizedException('E-posta veya şifre hatalı.');
        }

        // Link current visitor to this user if not already linked
        if (user.visitorId !== data.visitorId) {
            await this.prisma.user.update({
                where: { id: user.id },
                data: { visitorId: data.visitorId }
            });

            // Sync visitor record with user identity
            if (user.username) {
                await this.prisma.visitor.update({
                    where: { fingerprint: data.visitorId },
                    data: { username: user.username }
                });
            }
        }

        return {
            ...user,
            email: user.email // Ensure email is in returning object
        };
    }

    async upgradeToUser(data: { name: string, email: string, username: string, password?: string, phone?: string, visitorId: string, imageUrl?: string, isEdirnelim?: boolean | string }) {
        // Convert isEdirnelim to boolean if it comes as string
        const isEdirnelim = data.isEdirnelim === true || data.isEdirnelim === 'true';

        // Check if user already exists by email
        let user = await this.prisma.user.findUnique({ where: { email: data.email } });

        // Also check if username is taken by another user
        const usernameExists = await this.prisma.user.findUnique({ where: { username: data.username } });
        if (usernameExists && (!user || usernameExists.id !== user.id)) {
            throw new Error('Bu kullanıcı adı zaten alınmış.');
        }

        let hashedPassword = undefined;
        if (data.password) {
            hashedPassword = await bcrypt.hash(data.password, 10);
        }

        if (user) {
            // Update existing user with visitorId if not set
            const updatedUser = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    name: data.name,
                    username: data.username,
                    password: hashedPassword || user.password,
                    phone: data.phone,
                    imageUrl: data.imageUrl || user.imageUrl,
                    isEdirnelim: isEdirnelim,
                    visitorId: data.visitorId
                }
            });

            // Update visitor record to match User identity
            await this.prisma.visitor.update({
                where: { fingerprint: data.visitorId },
                data: { username: data.username }
            });

            return updatedUser;
        } else {
            // Create new user linked to visitor
            const newUser = await this.prisma.user.create({
                data: {
                    email: data.email,
                    username: data.username,
                    password: hashedPassword,
                    name: data.name,
                    phone: data.phone,
                    imageUrl: data.imageUrl,
                    isEdirnelim: isEdirnelim,
                    visitorId: data.visitorId,
                    role: 'VIEWER'
                }
            });

            // Update visitor record to match User identity
            await this.prisma.visitor.update({
                where: { fingerprint: data.visitorId },
                data: { username: data.username }
            });

            return newUser;
        }
    }

    async setCustomMessage(fingerprint: string, message: string) {
        return this.prisma.visitor.update({
            where: { fingerprint },
            data: { customMessage: message },
        });
    }
}
