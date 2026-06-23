const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function testOverlay() {
  const relativeImagePath = '/uploads/manual-image-1781877935163.png';
  const text = 'www.edirnego.com\nSiz de yerinizi alın !!!\n✍️ Görsele otomatik yazılmıştır';
  
  try {
    console.log('Testing image overlay...');
    // We will download the image from production since it's not local
    const url = 'https://api.edirnego.com' + relativeImagePath;
    console.log('Downloading test image from:', url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    const targetWidth = 1080;
    const targetHeight = 1920;
    
    // 1. Resize original image
    console.log('Resizing original image with smart aspect-ratio check...');
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 1080;
    const originalHeight = metadata.height || 1920;
    const resizedHeight = Math.round(originalHeight * (targetWidth / originalWidth));
    
    let resizedBuffer;
    if (resizedHeight > targetHeight) {
      console.log(`Image is too tall (${resizedHeight}px > 1920px). Resizing and cropping from top.`);
      resizedBuffer = await sharp(imageBuffer)
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'cover',
          position: 'top'
        })
        .toBuffer();
    } else {
      console.log(`Image height is within limits (${resizedHeight}px <= 1920px). Resizing by width.`);
      resizedBuffer = await sharp(imageBuffer)
        .resize({ width: targetWidth })
        .toBuffer();
    }

    // 2. Create canvas
    console.log('Creating canvas...');
    const processedBuffer = await sharp({
      create: {
        width: targetWidth,
        height: targetHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
    .composite([{ input: resizedBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();

    // Line wrapping
    const rawLines = text.split(/\r?\n/);
    const lines = [];
    for (const rawLine of rawLines) {
      const words = rawLine.trim().split(/\s+/);
      let currentLine = '';
      for (const word of words) {
        if (!word) continue;
        if ((currentLine + ' ' + word).length > 28) {
          if (currentLine) lines.push(currentLine.trim());
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        }
      }
      if (currentLine) {
        lines.push(currentLine.trim());
      }
    }

    console.log('Formatted lines:', lines);

    const fontSize = 42;
    const lineHeight = fontSize * 1.45;
    const padding = fontSize * 1.2;
    const boxHeight = lines.length * lineHeight + padding * 2;
    const boxWidth = targetWidth * 0.72;
    const boxX = (targetWidth - boxWidth) / 2;
    const boxY = targetHeight - boxHeight - (targetHeight * 0.16);

    let textElements = '';
    lines.forEach((line, index) => {
      const yPos = boxY + padding + (index * lineHeight) + fontSize;
      const escapedLine = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      textElements += `<text x="${targetWidth / 2}" y="${yPos}" fill="white" font-family="sans-serif" font-size="${fontSize}px" font-weight="bold" text-anchor="middle">${escapedLine}</text>`;
    });

    const svgOverlay = `
      <svg width="${targetWidth}" height="${targetHeight}">
        <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="${fontSize * 0.5}" ry="${fontSize * 0.5}" fill="black" fill-opacity="0.65" />
        ${textElements}
      </svg>
    `;

    console.log('Compositing text overlay...');
    const outDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outputAbsolutePath = path.join(outDir, 'test-story-output.png');
    
    await sharp(processedBuffer)
      .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
      .toFile(outputAbsolutePath);

    console.log('Success! Saved to:', outputAbsolutePath);
  } catch (error) {
    console.error('Error in testOverlay:', error);
  }
}

testOverlay();
