import './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('NEXUS API');
  const configService = app.get(ConfigService);

  // Security Middleware
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  
  // CORS configuration
  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  app.enableCors({
    origin: corsOrigins === '*' ? '*' : corsOrigins?.split(','),
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('NEXUS API')
    .setDescription('NEXUS Distributed AI Job Processing Platform API')
    .setVersion(configService.get<string>('APP_VERSION') || '0.1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('API_PORT') || 3001;
  await app.listen(port);
  logger.log(`Running on http://localhost:${port}`);
  logger.log(`Swagger docs on http://localhost:${port}/api/docs`);
}
bootstrap();
