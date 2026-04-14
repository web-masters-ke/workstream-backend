import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const mediaLocalDir = process.env.MEDIA_LOCAL_DIR || './uploads';
  app.use('/media', express.static(join(process.cwd(), mediaLocalDir)));

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  Logger.log(`Kaizen backend up on :${port}`, 'Bootstrap');
}
bootstrap();
