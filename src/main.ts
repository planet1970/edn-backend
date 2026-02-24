import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Global Prefix
  app.setGlobalPrefix('api/v1');

  // CORS Configuration (Allow Mobile and Web)
  app.enableCors({
    origin: '*', // Production'da spesifik domainlerle değiştirilmeli (örn: admin.edn.com)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false, // Temporarily disabled to check if fields are being stripped
      transform: true,
    }),
  );

  // Serve static uploads
  const uploadsPath = join(process.cwd(), 'uploads');
  console.log(`Serving static assets from: ${uploadsPath}`);
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads',
  });

  // Swagger Configuration (API Documentation)
  const config = new DocumentBuilder()
    .setTitle('EDN Backend API')
    .setDescription('API documentation for EDN Mobile and Web applications')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const PORT = process.env.PORT || 3000;
  await app.listen(PORT);
  console.log(`Application is running on: http://localhost:${PORT}/api/v1`);
  console.log(`Swagger Docs are available at: http://localhost:${PORT}/api/docs`);
}
bootstrap();
