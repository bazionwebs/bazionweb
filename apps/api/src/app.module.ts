import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { BillingModule } from './modules/billing/billing.module';
import { HostingModule } from './modules/hosting/hosting.module';
import { ReportsModule } from './modules/reports/reports.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { MfaGuard } from './common/guards/mfa.guard';
import { envValidationSchema } from './config/env.validation';
import { PricingModule } from './modules/pricing/pricing.module';
import { VaultModule } from './modules/vault/vault.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { PlatformProvisioningModule } from './modules/platform-provisioning/platform-provisioning.module';

@Module({
  imports: [
    // ── Configuration ──────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    // ── Rate limiting (OWASP A04 — Rate Limiting) ──────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        throttlers: [
          {
            ttl: cfg.get<number>('RATE_LIMIT_TTL', 60) * 1000,
            limit: cfg.get<number>('RATE_LIMIT_MAX', 100),
          },
        ],
      }),
    }),

    // ── Event bus for domain events ────────────────────────────────────────────
    EventEmitterModule.forRoot({ wildcard: true }),

    // ── Cron jobs (backups, SSL checks, report generation) ────────────────────
    ScheduleModule.forRoot(),

    // ── Core ───────────────────────────────────────────────────────────────────
    PrismaModule,

    // ── Feature modules ────────────────────────────────────────────────────────
    AuthModule,
    ClientsModule,
    ProjectsModule,
    TicketsModule,
    BillingModule,
    HostingModule,
    ReportsModule,
    QuotesModule,
    HealthModule,
    NotificationsModule,
    PricingModule,
    VaultModule,
    DiagnosticsModule,
    PlatformProvisioningModule,
  ],
  providers: [AuditInterceptor, MfaGuard, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
