
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const MODELS_AND_FIELDS = [
    { model: 'user', field: 'imageUrl', folder: 'profiles' },
    { model: 'subCategory', field: 'imageUrl', folder: 'subcategories' },
    { model: 'place', field: 'pic_url', folder: 'places' },
    { model: 'place', field: 'back_pic_url', folder: 'places' },
    { model: 'foodPlace', field: 'imageUrl', folder: 'foods' },
    { model: 'foodPlace', field: 'backImageUrl', folder: 'foods' },
    { model: 'foodPlace', field: 'campaignUrl', folder: 'foods' },
    { model: 'splashScreen', field: 'logoUrl', folder: 'logo' },
    { model: 'onboardingScreen', field: 'imageUrl', folder: 'main' },
    { model: 'webHeroSlide', field: 'imageUrl', folder: 'hero' },
    { model: 'webNavbar', field: 'logoUrl', folder: 'logo' },
    { model: 'storyAdvertisement', field: 'imageUrl', folder: 'ads' },
    { model: 'featuredAdvertisement', field: 'imageUrl', folder: 'ads' },
    { model: 'webGoogleAd', field: 'imageUrl', folder: 'ads' },
    { model: 'webPopupAd', field: 'imageUrl', folder: 'ads' },
    { model: 'webDefaultPopup', field: 'imageUrl', folder: 'ads' },
    { model: 'popularPlaceAdvertisement', field: 'imageUrl', folder: 'places' },
    { model: 'tempPlace', field: 'pic_url', folder: 'places' },
    { model: 'tempPlace', field: 'back_pic_url', folder: 'places' },
    { model: 'tempFoodPlace', field: 'imageUrl', folder: 'foods' },
    { model: 'tempFoodPlace', field: 'backImageUrl', folder: 'foods' },
    { model: 'tempFoodPlace', field: 'campaignUrl', folder: 'foods' },
];

async function downloadImage(url: string, folder: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const buffer = await response.arrayBuffer();
        
        const uploadDir = path.join(process.cwd(), 'uploads', folder);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const urlParts = url.split('/');
        const originalFileName = urlParts[urlParts.length - 1];
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName = `${uniqueSuffix}-${originalFileName}`;
        const filePath = path.join(uploadDir, fileName);

        fs.writeFileSync(filePath, Buffer.from(buffer));
        
        return `/uploads/${folder}/${fileName}`;
    } catch (error) {
        console.error(`Failed to download ${url}:`, error);
        return null;
    }
}

async function migrate() {
    console.log('Starting Cloudinary to Local migration...');

    for (const item of MODELS_AND_FIELDS) {
        try {
            console.log(`Checking ${item.model}.${item.field}...`);
            
            // Use any to bypass TS checks on dynamic prisma keys
            const records = await (prisma as any)[item.model].findMany({
                where: {
                    [item.field]: {
                        contains: 'cloudinary.com'
                    }
                }
            });

            if (records.length === 0) continue;
            console.log(`Found ${records.length} records in ${item.model}`);

            for (const record of records) {
                const url = record[item.field];
                if (!url) continue;

                const localPath = await downloadImage(url, item.folder);
                if (localPath) {
                    await (prisma as any)[item.model].update({
                        where: { id: record.id },
                        data: {
                            [item.field]: localPath
                        }
                    });
                    console.log(`Migrated ${item.model} ID ${record.id}: ${url} -> ${localPath}`);
                }
            }
        } catch (modelError: any) {
            console.warn(`Could not migrate model ${item.model}: ${modelError.message}`);
            continue; // Skip current model and continue with next
        }
    }

    console.log('Migration completed!');
}

migrate()
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
