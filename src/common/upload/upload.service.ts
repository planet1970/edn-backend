import { Injectable } from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
    constructor(private readonly cloudinaryService: CloudinaryService) { }

    async handleFile(
        file: Express.Multer.File,
        folder: string,
    ): Promise<string> {
        if (!file) return '';

        if (process.env.NODE_ENV === 'production') {
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
}