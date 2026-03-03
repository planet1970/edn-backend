
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const scriptCode = '<div style="background:linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border: 1px solid #d1d9e6; width: 100%; height: 160px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">\n    <div style="position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.05); color: #888; font-size: 9px; padding: 2px 8px; border-bottom-left-radius: 8px;">Ads by Google</div>\n    <div style="width: 40px; height: 40px; background: #4285F4; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; margin-bottom: 8px;">\n        <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>\n    </div>\n    <div style="font-weight: bold; color: #1a1a2e; font-size: 14px; text-shadow: 0 1px 0 #fff;">Google AdSense (Örnek)</div>\n    <div style="color: #4285f4; font-size: 11px; margin-top: 4px;">adsense-unit-7788-responsive</div>\n</div>';

    await prisma.webGoogleAd.upsert({
        where: { areaName: 'HOME_RIGHT' },
        update: {
            type: 'SCRIPT',
            scriptCode,
            isActive: true
        },
        create: {
            areaName: 'HOME_RIGHT',
            type: 'SCRIPT',
            scriptCode,
            isActive: true
        }
    });
    console.log('HOME_RIGHT Google reklam alanı basariyla guncellendi.');
}
main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
