import { NextResponse } from 'next/server';
import { isWebSelfHost, resolveApiBase } from '@/lib/api-base';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

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
 *   - Dot-segments ('.'/'..') in the path are rejected — the URL constructor
 *     normalises them, which would let a caller escape the /api/v1 scope.
 *   - Client-supplied IP forwarding headers (x-forwarded-for / x-real-ip) are
 *     never passed through untouched; the upstream only receives the
 *     edge-derived client IP, so the caller cannot spoof its source address.
 *   - Bodies are capped — unbounded buffering would enable memory-DoS.
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
// x-real-ip / x-forwarded-for are deliberately NOT forwarded from the client:
// they are attacker-controllable in every position except a trusted hop's
// appended value. Instead the edge-derived client IP (cf-connecting-ip when
// present, else the proxy-validated XFF tail) is re-emitted upstream.
const FORWARDED_HEADER_ALLOWLIST = [
  'authorization',
  'content-type',
  'accept',
  'accept-language',
  'user-agent',
  'x-request-id',
];

const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB — webhooks stay far below this.
const MAX_SEGMENTS = 12;
const MAX_SEGMENT_LENGTH = 128;
const GATEWAY_RATE_LIMIT = 300; // requests
const GATEWAY_RATE_WINDOW_MS = 60_000; // per minute, per client IP

const isLoopbackHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '::1';

/**
 * A catch-all param segment has already been percent-decoded by Next.
 * Reject anything that could rewrite the target path when re-encoded:
 * dot-segments, path separators, and control characters.
 */
function sanitizeSegments(segments: string[]): boolean {
  if (!Array.isArray(segments)) return false;
  if (segments.length === 0 || segments.length > MAX_SEGMENTS) return false;
  for (const segment of segments) {
    if (typeof segment !== 'string') return false;
    if (segment.length === 0 || segment.length > MAX_SEGMENT_LENGTH) return false;
    // Dot-only segments would normalise out of /api/v1 in the target URL.
    if (/^[./]+$/.test(segment)) return false;
    // Separators or control characters cannot legitimately occur in a path segment.
    if (/[/\\%\u0000-\u001F]/.test(segment)) return false;
  }
  return true;
}

async function proxy(req: Request, segments: string[]): Promise<Response> {
  const clientIp = getClientIp(req);
  const rl = checkRateLimit(`gateway:${clientIp}`, GATEWAY_RATE_LIMIT, GATEWAY_RATE_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests from this client. Please slow down.' },
      { status: 429 },
    );
  }

  if (!sanitizeSegments(segments)) {
    return NextResponse.json(
      { error: 'Invalid API gateway path.' },
      { status: 400 },
    );
  }

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
  // Re-emit the client's source address from edge-trusted data only. Never
  // forward a client-supplied X-Forwarded-For/X-Real-IP chain verbatim.
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) {
    headers.set('x-forwarded-for', cfIp.trim().split(',')[0].trim());
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  if (hasBody && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  let body: ArrayBuffer | undefined;
  if (hasBody) {
    const declaredLength = Number(req.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
    }
    body = await req.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method,
      headers,
      body,
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

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: RouteContext) { const { path } = await ctx.params; return proxy(req, path); }
export async function POST(req: Request, ctx: RouteContext) { const { path } = await ctx.params; return proxy(req, path); }
export async function PUT(req: Request, ctx: RouteContext) { const { path } = await ctx.params; return proxy(req, path); }
export async function PATCH(req: Request, ctx: RouteContext) { const { path } = await ctx.params; return proxy(req, path); }
export async function DELETE(req: Request, ctx: RouteContext) { const { path } = await ctx.params; return proxy(req, path); }
export async function HEAD(req: Request, ctx: RouteContext) { const { path } = await ctx.params; return proxy(req, path); }
export async function OPTIONS(req: Request, ctx: RouteContext) { const { path } = await ctx.params; return proxy(req, path); }
