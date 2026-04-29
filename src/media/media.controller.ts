import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import * as fs from 'fs';
import * as path from 'path';

@Controller('media')
@UseGuards(AuthGuard('jwt'), RoleGuard)
@Roles('ADMIN')
export class MediaController {
    private readonly uploadRoot = path.join(process.cwd(), 'uploads');

    @Get('list')
    async listMedia() {
        try {
            const files: any[] = [];
            this.scanDirectory(this.uploadRoot, files);
            
            // Sort by date desc safely
            files.sort((a, b) => {
                const dateA = new Date(a.created_at).getTime() || 0;
                const dateB = new Date(b.created_at).getTime() || 0;
                return dateB - dateA;
            });

            return { resources: files };
        } catch (error) {
            console.error("Media listesi alınırken hata oluştu:", error);
            return { resources: [] }; // Hata olsa bile 500 dönmemesi için boş liste dönüyoruz
        }
    }

    @Get('stats')
    async getStats() {
        try {
            const files: any[] = [];
            this.scanDirectory(this.uploadRoot, files);

            const totalBytes = files.reduce((acc, f) => acc + (f.bytes || 0), 0);
            
            return {
                storage: {
                    used: totalBytes,
                    limit: 10 * 1024 * 1024 * 1024 // 10GB Virtual Limit
                },
                bandwidth: {
                    used: 0
                }
            };
        } catch (error) {
            console.error("Media istatistikleri alınırken hata oluştu:", error);
            return {
                storage: { used: 0, limit: 10 * 1024 * 1024 * 1024 },
                bandwidth: { used: 0 }
            };
        }
    }

    @Delete(':path(*)')
    async deleteMedia(@Param('path') filePath: string) {
        try {
            const fullPath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.substring(1) : filePath);
            
            if (!fullPath.startsWith(this.uploadRoot)) {
                return { success: false, message: 'Unauthorized deletion path' };
            }

            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                return { success: true };
            }
            return { success: false, message: 'File not found' };
        } catch (error) {
            console.error("Dosya silinirken hata oluştu:", error);
            return { success: false, message: 'Sunucu hatası oluştu' };
        }
    }

    private scanDirectory(dir: string, fileList: any[]) {
        try {
            if (!fs.existsSync(dir)) return;

            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                try {
                    const stat = fs.statSync(filePath);

                    if (stat.isDirectory()) {
                        this.scanDirectory(filePath, fileList);
                    } else {
                        const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
                        fileList.push({
                            public_id: relativePath,
                            secure_url: `/${relativePath}`,
                            bytes: stat.size,
                            // Linux sunucularında birthtime her zaman bulunmaz, mtime (değiştirilme zamanı) daha güvenlidir
                            created_at: stat.birthtime || stat.mtime || new Date(),
                            format: path.extname(file).substring(1),
                            width: 0,
                            height: 0
                        });
                    }
                } catch (err) {
                    console.error(`Dosya stat okunamadı: ${filePath}`, err);
                }
            });
        } catch (error) {
            console.error(`Dizin taranamadı: ${dir}`, error);
        }
    }
}
