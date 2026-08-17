import './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('ProcessorWorker');
  
  app.enableShutdownHooks();

  logger.log('Worker Processor is running and listening to queues...');
}

bootstrap();
