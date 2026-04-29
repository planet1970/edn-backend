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
        const files: any[] = [];
        this.scanDirectory(this.uploadRoot, files);
        
        // Sort by date desc
        files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return { resources: files };
    }

    @Get('stats')
    async getStats() {
        const files: any[] = [];
        this.scanDirectory(this.uploadRoot, files);

        const totalBytes = files.reduce((acc, f) => acc + f.bytes, 0);
        
        return {
            storage: {
                used: totalBytes,
                limit: 10 * 1024 * 1024 * 1024 // 10GB Virtual Limit
            },
            bandwidth: {
                used: 0 // Local bandwidth is not tracked
            }
        };
    }

    @Delete(':path(*)')
    async deleteMedia(@Param('path') filePath: string) {
        const fullPath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.substring(1) : filePath);
        
        // Security check: Must be inside uploads folder
        if (!fullPath.startsWith(this.uploadRoot)) {
            throw new Error('Unauthorized deletion path');
        }

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            return { success: true };
        }
        return { success: false, message: 'File not found' };
    }

    private scanDirectory(dir: string, fileList: any[]) {
        if (!fs.existsSync(dir)) return;

        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                this.scanDirectory(filePath, fileList);
            } else {
                const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
                fileList.push({
                    public_id: relativePath,
                    secure_url: `/${relativePath}`,
                    bytes: stat.size,
                    created_at: stat.birthtime,
                    format: path.extname(file).substring(1),
                    width: 0, // In local mode, we don't store width/height unless we process all files with sharp (slow)
                    height: 0
                });
            }
        });
    }
}
