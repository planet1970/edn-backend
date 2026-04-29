
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class VisitorsService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.visitor.findMany({
            orderBy: { lastVisitAt: 'desc' },
        });
    }

    async trackVisitor(fingerprint: string, ip?: string, userAgent?: string) {
        try {
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

                return await this.prisma.visitor.create({
                    data: {
                        fingerprint,
                        username,
                        lastIp: ip,
                        userAgent,
                        visitCount: 1,
                    },
                });
            }
        } catch (error) {
            // Eğer unique constraint hatası gelirse (Race condition), mevcut olanı tekrar bulup dön
            return await this.prisma.visitor.findUnique({
                where: { fingerprint },
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

    async upgradeToUser(data: { name: string, email: string, username: string, password?: string, phone?: string, visitorId: string, imageUrl?: string, isEdirnelim?: boolean | string, googleId?: string }) {
        console.log('--- UpgradeToUser Request Data ---', data);
        
        try {
            // Validation check
            if (!data.email || data.email === 'undefined') {
                console.error('Upgrade failed: Missing email', { data });
                throw new BadRequestException('E-posta adresi zorunludur.');
            }

            if (!data.username || data.username === 'undefined') {
                console.error('Upgrade failed: Missing username', { data });
                throw new BadRequestException('Kullanıcı adı zorunludur.');
            }

            if (!data.visitorId || data.visitorId === 'undefined') {
                console.error('Upgrade failed: Missing visitorId', { data });
                throw new BadRequestException('Ziyaretçi kimliği bulunamadı.');
            }

            // Convert isEdirnelim to boolean if it comes as string (FormData sends everything as string)
            const isEdirnelim = data.isEdirnelim === true || data.isEdirnelim === 'true';
            console.log('Converted isEdirnelim:', isEdirnelim);

            // Check if email is already taken by ANOTHER visitor/user
            let user = await this.prisma.user.findUnique({ where: { email: data.email } });
            console.log('Existing user by email:', user ? user.id : 'none');
            
            if (user && user.visitorId && user.visitorId !== data.visitorId) {
                throw new ConflictException('Bu e-posta adresi zaten başka bir hesap tarafından kullanılıyor.');
            }

            // Check if username is already taken by ANOTHER visitor/user
            const userByUsername = await this.prisma.user.findUnique({ where: { username: data.username } });
            console.log('Existing user by username:', userByUsername ? userByUsername.id : 'none');
            
            if (userByUsername && userByUsername.visitorId !== data.visitorId) {
                throw new ConflictException('Bu kullanıcı adı zaten başka bir üye tarafından kullanılıyor.');
            }

            // Also check if username is used in a visitor record that NO user has claimed yet
            const visitorByUsername = await this.prisma.visitor.findUnique({ where: { username: data.username } });
            if (visitorByUsername && visitorByUsername.fingerprint !== data.visitorId) {
                const linkedUser = await this.prisma.user.findUnique({ where: { visitorId: visitorByUsername.fingerprint } });
                if (linkedUser) {
                    throw new ConflictException('Bu kullanıcı adı zaten alınmış.');
                }
            }

            let hashedPassword = undefined;
            if (data.password && data.password.trim() !== '' && data.password !== 'undefined') {
                hashedPassword = await bcrypt.hash(data.password, 10);
            }

            if (user) {
                console.log('Updating existing user:', user.id);
                // Update existing user with visitorId if not set
                const updatedUser = await this.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        name: data.name || user.name,
                        username: data.username,
                        password: hashedPassword || user.password,
                        phone: data.phone || user.phone,
                        imageUrl: data.imageUrl || user.imageUrl,
                        isEdirnelim: isEdirnelim,
                        visitorId: data.visitorId,
                        googleId: data.googleId || user.googleId
                    }
                });

                // Update visitor record to match User identity
                await this.prisma.visitor.update({
                    where: { fingerprint: data.visitorId },
                    data: { username: data.username }
                });

                return updatedUser;
            } else {
                console.log('Creating new user for visitorId:', data.visitorId);
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
                        roleId: 'USER',
                        isActive: true,
                        googleId: data.googleId
                    } as any
                });

                // Update visitor record to match User identity
                await this.prisma.visitor.update({
                    where: { fingerprint: data.visitorId },
                    data: { username: data.username }
                });

                return newUser;
            }
        } catch (error) {
            console.error('CRITICAL ERROR in upgradeToUser:', error);
            if (error instanceof ConflictException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(`İşlem başarısız: ${error.message}`);
        }
    }

    async setCustomMessage(fingerprint: string, message: string) {
        return this.prisma.visitor.update({
            where: { fingerprint },
            data: { customMessage: message },
        });
    }
}
