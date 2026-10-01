import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

const AUDITABLE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Paths that don't require audit logs
const AUDIT_EXEMPT_PATHS = ['/api/v1/health', '/api/v1/auth/refresh', '/api/v1/auth/login'];

const SENSITIVE_KEYS = new Set(['password', 'accessToken', 'refreshToken', 'cardToken', 'secret']);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : redact(v);
    }
    return out;
  }
  return value;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers } = request;

    if (
      !AUDITABLE_METHODS.includes(method) ||
      AUDIT_EXEMPT_PATHS.some(p => url.startsWith(p))
    ) {
      return next.handle();
    }

    const [resourceType, resourceId] = this.parseResource(url);

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          await this.prisma.auditLog.create({
            data: {
              userId: user?.id ?? null,
              action: `${resourceType}.${method.toLowerCase()}`,
              resourceType,
              resourceId: resourceId ?? null,
              newValue: method !== 'DELETE' ? (redact((responseData as any)?.data) as any) ?? null : null,
              ipAddress: (Array.isArray(ip) ? ip[0] : ip) ?? null,
              userAgent: headers['user-agent'] ?? null,
            },
          });
        } catch {
          // Audit log failure must not break the request
        }
      }),
    );
  }

  private parseResource(url: string): [string, string | null] {
    // /api/v1/clients/uuid → ['clients', 'uuid']
    const parts = url.split('/').filter(Boolean);
    const apiIdx = parts.findIndex(p => p === 'v1');
    if (apiIdx === -1) return ['unknown', null];
    const resource = parts[apiIdx + 1] ?? 'unknown';
    const id = parts[apiIdx + 2] ?? null;
    return [resource, id];
  }
}
