import { NextResponse } from 'next/server';
import { isWebSelfHost, resolveApiBase } from '@/lib/api-base';

export const dynamic = 'force-dynamic';

/**
 * Same-origin API v1 gateway.
 *
 * Deployment layout routes /api/v1 to the NestJS service at the edge
 * (Traefik Host+PathPrefix rule). Some deployments only expose the web
 * origin publicly, so this runtime catch-all proxies every remaining
 * /api/v1/* call to the API resolved by resolveApiBase():
 *
 *   - Docker/Dokploy  -> API_INTERNAL_URL (http://api:4000)
 *   - External hosts  -> NEXT_PUBLIC_API_URL
 *   - Local dev       -> http://localhost:4000
 *
 * Security notes:
 *   - x-internal-dispatch is NEVER forwarded — anonymous callers cannot mint
 *     magi/claim/reset tokens; only the BFF routes on this origin carry it.
 *   - Only a conservative header allowlist is forwarded (no cookies, no host).
 *   - A self-origin target is rejected to prevent proxy recursion.
 *
 * Request bodies are buffered (raw bytes preserved) so HMAC-verified
 * webhooks (e.g. POST /api/v1/webhooks/paystack) keep their exact payload.
 */

const HOP_BY_HOP_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'trailers',
]);

// Forwarded only if present; never spoofable into token minting.
// Forbidden edge headers (cf-connecting-ip, cf-ray, cf-ipcountry, cf-visitor)
// are strictly omitted to prevent Cloudflare edge recursion errors.
const FORWARDED_HEADER_ALLOWLIST = [
  'authorization',
  'content-type',
  'accept',
  'accept-language',
  'user-agent',
  'x-request-id',
  'x-real-ip',
  'x-forwarded-for',
];

const UPSTREAM_TIMEOUT_MS = 30_000;

const isLoopbackHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '::1';

async function proxy(req: Request, segments: string[]): Promise<Response> {
  const apiBase = resolveApiBase();

  let target: URL;
  try {
    target = new URL(`/api/v1/${segments.map(encodeURIComponent).join('/')}`, apiBase);

    // Loop detection:
    // 1. Direct comparison with request origin (e.g. http://localhost:3000)
    const requestOrigin = new URL(req.url).origin;
    if (target.origin === requestOrigin) {
      return NextResponse.json(
        {
          error: 'Self-referential gateway loop detected. Configure API_INTERNAL_URL.',
        },
        { status: 503 },
      );
    }

    // 2. Comparison with incoming Host and X-Forwarded-Host headers.
    // Exclude loopback hosts from simple hostname equality so local dev
    // (e.g. localhost:3000 -> localhost:4000) is allowed.
    const rawHostHeader =
      req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
      req.headers.get('host') ||
      '';
    const [incomingHost, incomingPort] = rawHostHeader.toLowerCase().split(':');
    const targetHost = target.hostname.toLowerCase();
    const targetPort = target.port || (target.protocol === 'https:' ? '443' : '80');
    const incomingPortResolved =
      incomingPort || (new URL(req.url).protocol === 'https:' ? '443' : '80');

    const isSelfHost = isWebSelfHost(targetHost);
    const isNonLoopbackHostMatch =
      !isLoopbackHost(targetHost) && Boolean(incomingHost) && targetHost === incomingHost;
    const isLoopbackLoop =
      isLoopbackHost(targetHost) &&
      isLoopbackHost(incomingHost) &&
      targetPort === incomingPortResolved;

    if (isSelfHost || isNonLoopbackHostMatch || isLoopbackLoop) {
      return NextResponse.json(
        {
          error: 'Self-referential gateway loop detected. Configure API_INTERNAL_URL.',
        },
        { status: 503 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid API gateway configuration' }, { status: 503 });
  }

  const search = new URL(req.url).search;
  if (search) target.search = search;

  const headers = new Headers();
  for (const name of FORWARDED_HEADER_ALLOWLIST) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  if (hasBody && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json(
      { error: 'API service is unreachable from the gateway. Try again shortly.' },
      { status: 502 },
    );
  }

  // Intercept Cloudflare or edge HTML error responses (e.g. Error 1000)
  // to avoid leaking raw HTML error pages to JSON clients.
  // Genuine application JSON 403 responses (e.g. NestJS guards) are preserved.
  const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    return NextResponse.json(
      { error: 'Upstream service unavailable', status: 502 },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    if (lower === 'content-encoding' || lower === 'content-length') return;
    if (lower === 'x-internal-dispatch') return;
    responseHeaders.append(name, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = { params: { path: string[] } };

export async function GET(req: Request, ctx: RouteContext) { return proxy(req, ctx.params.path); }
export async function POST(req: Request, ctx: RouteContext) { return proxy(req, ctx.params.path); }
export async function PUT(req: Request, ctx: RouteContext) { return proxy(req, ctx.params.path); }
export async function PATCH(req: Request, ctx: RouteContext) { return proxy(req, ctx.params.path); }
export async function DELETE(req: Request, ctx: RouteContext) { return proxy(req, ctx.params.path); }
export async function HEAD(req: Request, ctx: RouteContext) { return proxy(req, ctx.params.path); }
export async function OPTIONS(req: Request, ctx: RouteContext) { return proxy(req, ctx.params.path); }
