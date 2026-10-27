import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

async function bootstrap() {
  // rawBody:true preserves exact webhook bytes for HMAC verification
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    rawBody: true,
  });

  const config = app.get(ConfigService);

  // ── Security ────────────────────────────────────────────────────────────────
  const securityHeaders: Record<string, string> = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
  app.use((_request, response, next) => {
    for (const [name, value] of Object.entries(securityHeaders)) {
      response.setHeader(name, value);
    }
    if (config.get('NODE_ENV') === 'production') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    next();
  });

  // ── CORS ─────────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      'https://bazionweb.com',
      'https://portal.bazionweb.com',
      'https://admin.bazionweb.com',
      ...(config.get('NODE_ENV') !== 'production'
        ? ['http://localhost:3000', 'http://localhost:3001']
        : []),
    ],
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
