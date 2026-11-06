import { NextResponse } from 'next/server';
import { resolveApiBase } from '@/lib/api-base';

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
const FORWARDED_HEADER_ALLOWLIST = [
  'authorization',
  'content-type',
  'accept',
  'accept-language',
  'user-agent',
  'x-request-id',
  'x-real-ip',
  'cf-connecting-ip',
  'x-forwarded-for',
];

const UPSTREAM_TIMEOUT_MS = 30_000;

async function proxy(req: Request, segments: string[]): Promise<Response> {
  const apiBase = resolveApiBase();

  let target: URL;
  try {
    const requestOrigin = new URL(req.url).origin;
    if (apiBase === requestOrigin) {
      return NextResponse.json(
        {
          error: 'API origin misconfigured: gateway target equals this origin. Set API_INTERNAL_URL or NEXT_PUBLIC_API_URL.',
        },
        { status: 503 },
      );
    }
    target = new URL(`/api/v1/${segments.map(encodeURIComponent).join('/')}`, apiBase);
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
