import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

async function bootstrap() {
  // rawBody:true preserves exact webhook bytes for HMAC verification
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
    rawBody: true,
  });

  const config = app.get(ConfigService);

  // Trust single upstream reverse proxy (Render / Cloudflare / Nginx) so
  // ThrottlerGuard & AuditInterceptor resolve real client IPs accurately.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ── Security ────────────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts:
        config.get('NODE_ENV') === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use((_request, response, next) => {
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // ── CORS ─────────────────────────────────────────────────────────────────────
  const configuredFrontendUrl = config.get<string>('FRONTEND_URL')?.trim();
  const allowedOrigins = Array.from(
    new Set([
      'https://bazionweb.com',
      'https://www.bazionweb.com',
      'https://portal.bazionweb.com',
      'https://admin.bazionweb.com',
      ...(configuredFrontendUrl ? [configuredFrontendUrl.replace(/\/+$/, '')] : []),
      ...(config.get('NODE_ENV') !== 'production'
        ? ['http://localhost:3000', 'http://localhost:3001']
        : []),
    ]),
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── Versioning ───────────────────────────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');

  // ── Validation ───────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // strip unknown fields
      forbidNonWhitelisted: true, // 400 on unknown fields
      transform: true,            // auto-coerce types
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global filters & interceptors ────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    app.get(AuditInterceptor),
  );

  // ── Swagger (non-production) ─────────────────────────────────────────────────
  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BazionWeb API')
      .setDescription('BazionWeb REST API — Managed Website Lifecycle Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth')
      .addTag('clients')
      .addTag('projects')
      .addTag('tickets')
      .addTag('hosting')
      .addTag('billing')
      .addTag('reports')
      .addTag('quotes')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  console.log(`🚀 BazionWeb API running on port ${port}`);
}

bootstrap();
