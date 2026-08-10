import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { configureHttpSecurity } from './common/security/http-security';
import { requestIdMiddleware } from './common/http/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT') ?? 3001);

  app.setGlobalPrefix('api');

  app.use(requestIdMiddleware);
  app.use(cookieParser());
  configureHttpSecurity(app, config);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on port ${port}`);
}

void bootstrap();
