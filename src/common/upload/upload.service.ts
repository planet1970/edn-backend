import { Injectable, BadRequestException } from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

@Injectable()
export class UploadService {
    private readonly MAX_SIZE = 5 * 1024 * 1024; // 5MB limit
    private readonly ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    private readonly MAX_WIDTH = 1200; // Standardize image width

    constructor(private readonly cloudinaryService: CloudinaryService) { }

    private validateFile(file: Express.Multer.File) {
        if (!this.ALLOWED_MIMETYPES.includes(file.mimetype)) {
            throw new BadRequestException(`Geçersiz dosya formatı: ${file.mimetype}. Sadece JPG, PNG, WEBP ve GIF formatlarına izin verilir.`);
        }

        if (file.size > this.MAX_SIZE) {
            throw new BadRequestException(`Dosya boyutu çok büyük: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maksimum limit: ${this.MAX_SIZE / 1024 / 1024}MB`);
        }
    }

    async handleFile(
        file: Express.Multer.File,
        folder: string,
        oldUrl?: string // Optional: provide old URL to delete it automatically
    ): Promise<string> {
        if (!file) return oldUrl || '';

        // Safely delete old file if provided
        if (oldUrl) {
            await this.deleteFile(oldUrl);
        }

        this.validateFile(file);

        // Cloudinary devre dışı bırakıldı - Sadece sunucu üzerindeki yerel disk kullanılacak

        // Local development / Local hosting
        const uploadPath = path.join(process.cwd(), 'uploads', folder);
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName = `${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`;
        const filePath = path.join(uploadPath, fileName);

        try {
            // Optimization: Resize large images using sharp
            let processor = sharp(file.buffer);
            const metadata = await processor.metadata();

            if (metadata.width && metadata.width > this.MAX_WIDTH) {
                processor = processor.resize(this.MAX_WIDTH);
            }

            // Convert to webp if it's large? Or keep original extension.
            // Let's keep original for now but high compression.
            await processor
                .jpeg({ quality: 80, mozjpeg: true })
                .toFile(filePath);

        } catch (error) {
            console.error('Sharp processing error, falling back to original:', error);
            fs.writeFileSync(filePath, file.buffer);
        }

        return `/uploads/${folder}/${fileName}`;
    }

    async deleteFile(fileUrl: string): Promise<void> {
        if (!fileUrl || fileUrl.startsWith('http')) return; // Skip external urls (Cloudinary/fallback)

        try {
            // Local development
            const relativePath = fileUrl.replace(/^\//, '');
            const filePath = path.join(process.cwd(), relativePath);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Successfully deleted file: ${filePath}`);
            }
        } catch (error) {
            console.warn('File deletion failed (ignoring):', error);
        }
    }
}