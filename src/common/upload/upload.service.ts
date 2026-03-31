import { Injectable, BadRequestException } from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
    private readonly MAX_SIZE = 2 * 1024 * 1024; // 2MB
    private readonly ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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
    ): Promise<string> {
        if (!file) return '';

        this.validateFile(file);

        const useCloudinary = process.env.NODE_ENV === 'production' || !!process.env.CLOUDINARY_CLOUD_NAME;

        if (useCloudinary) {
            const result = await this.cloudinaryService.uploadImage(file, folder);
            return result.secure_url;
        }

        // Local development
        const uploadPath = path.join(process.cwd(), 'uploads', folder);
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName = `${uniqueSuffix}${path.extname(file.originalname)}`;
        const filePath = path.join(uploadPath, fileName);

        fs.writeFileSync(filePath, file.buffer);

        return `/uploads/${folder}/${fileName}`;
    }

    async deleteFile(fileUrl: string): Promise<void> {
        if (!fileUrl) return;

        try {
            const isCloudinary = !!process.env.CLOUDINARY_CLOUD_NAME || fileUrl.includes('cloudinary.com');

            if (isCloudinary) {
                const urlParts = fileUrl.split('/');
                const fileNameWithExt = urlParts[urlParts.length - 1];
                const publicIdWithoutExt = fileNameWithExt.split('.')[0];
                const folder = urlParts[urlParts.length - 2];
                const publicId = `${folder}/${publicIdWithoutExt}`;

                await this.cloudinaryService.deleteImage(publicId);
                return;
            }

            // Local development
            const relativePath = fileUrl.replace(/^\//, '');
            const filePath = path.join(process.cwd(), relativePath);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error('File deletion error:', error);
        }
    }
}