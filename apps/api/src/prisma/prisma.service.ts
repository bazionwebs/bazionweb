import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const TRANSIENT_PRISMA_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);
const TRANSIENT_ERROR_RE =
  /can't reach database server|server has closed the connection|connection.*(closed|reset|terminated|refused|timed out)|econnreset|etimedout|socket hang up|kind:\s*closed/i;

function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as Record<string, unknown>).code;
  if (typeof code === 'string' && TRANSIENT_PRISMA_CODES.has(code)) return true;
  const msg = String((err as Record<string, unknown>).message || '');
  return TRANSIENT_ERROR_RE.test(msg);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';
    super({
      log: isProd
        ? [
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ],
    });

    // Resilient retry middleware for Neon Serverless Postgres idle socket closures & brief network blips
    if (typeof (this as any).$use === 'function') {
      (this as any).$use(async (params: any, next: (params: any) => Promise<any>) => {
        const maxRetries = 2;
        for (let attempt = 0; ; attempt++) {
          try {
            return await next(params);
          } catch (err) {
            if (attempt >= maxRetries || !isTransientDbError(err)) {
              throw err;
            }
            const delayMs = (attempt + 1) * 200;
            this.logger.warn(
              `Transient DB connection error on ${params.model ?? 'raw'}.${params.action} (attempt ${attempt + 1}/${maxRetries}) — reconnecting in ${delayMs}ms`,
            );
            await new Promise((r) => setTimeout(r, delayMs));
            try {
              await this.$connect();
            } catch {
              // Next attempt will trigger connection initialization
            }
          }
        }
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL via Prisma');

    // Log slow queries (>200ms) in development
    if (process.env.NODE_ENV !== 'production') {
      (this as any).$on('query', (e: any) => {
        if (e.duration > 200) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Soft-delete helper: sets deletedAt instead of hard deleting */
  async softDelete(model: string, id: string): Promise<void> {
    await (this as any)[model].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
