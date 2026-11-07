/**
 * @jest-environment node
 */

import { resolveApiBase } from '@/lib/api-base';
import { GET as gatewayGet } from '@/app/api/v1/[...path]/route';

const ORIGINAL_ENV = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function gatewayRequest(path: string, headers: Record<string, string> = {}) {
  return new Request(`https://bazionweb.com/api/v1/${path}`, {
    headers: { host: 'bazionweb.com', ...headers },
  });
}

describe('API gateway: server-side API base & loop guard', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = originalFetch;
  });

  describe('resolveApiBase() on the server', () => {
    it('prefers API_INTERNAL_URL', () => {
      setEnv({ API_INTERNAL_URL: 'http://bazionweb-api:4000', NEXT_PUBLIC_API_URL: undefined });
      expect(resolveApiBase()).toBe('http://bazionweb-api:4000');
    });

    it('never falls back to its own public or staging web domain', () => {
      setEnv({
        API_INTERNAL_URL: undefined,
        NEXT_PUBLIC_API_URL: 'https://bazionweb.com/api/v1',
        NODE_ENV: 'production',
      });
      expect(resolveApiBase()).toBe('http://api:4000');

      setEnv({
        API_INTERNAL_URL: undefined,
        NEXT_PUBLIC_API_URL: 'https://staging.bazionweb.com/api/v1',
        NODE_ENV: 'production',
      });
      expect(resolveApiBase()).toBe('http://api:4000');
    });
  });

  describe('[...path] gateway', () => {
    it('does not forward Cloudflare edge headers upstream', async () => {
      setEnv({ API_INTERNAL_URL: 'http://bazionweb-api:4000' });
      const fetchMock = jest.fn().mockResolvedValue(
        new Response('{"data":[]}', { status: 200, headers: { 'content-type': 'application/json' } }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const res = await gatewayGet(
        gatewayRequest('plans', { 'cf-connecting-ip': '1.2.3.4', 'cf-ray': 'abc', authorization: 'Bearer t' }),
        { params: { path: ['plans'] } },
      );

      expect(res.status).toBe(200);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://bazionweb-api:4000/api/v1/plans');
      const sent = init.headers as Headers;
      expect(sent.get('cf-connecting-ip')).toBeNull();
      expect(sent.get('cf-ray')).toBeNull();
      expect(sent.get('authorization')).toBe('Bearer t');
    });

    it('refuses to proxy back to bazionweb.com (503, no fetch)', async () => {
      setEnv({ API_INTERNAL_URL: 'https://bazionweb.com' });
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const res = await gatewayGet(gatewayRequest('plans'), { params: { path: ['plans'] } });

      expect(res.status).toBe(503);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('allows local dev proxying from :3000 to :4000', async () => {
      setEnv({ API_INTERNAL_URL: 'http://localhost:4000' });
      const fetchMock = jest.fn().mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const req = new Request('http://localhost:3000/api/v1/plans', { headers: { host: 'localhost:3000' } });
      const res = await gatewayGet(req, { params: { path: ['plans'] } });

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('turns an upstream HTML error page into JSON 502', async () => {
      setEnv({ API_INTERNAL_URL: 'http://bazionweb-api:4000' });
      global.fetch = jest.fn().mockResolvedValue(
        new Response('<html>DNS points to prohibited IP</html>', {
          status: 403,
          headers: { 'content-type': 'text/html; charset=UTF-8' },
        }),
      ) as unknown as typeof fetch;

      const res = await gatewayGet(gatewayRequest('plans'), { params: { path: ['plans'] } });

      expect(res.status).toBe(502);
      expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('passes genuine API JSON 403 responses through unchanged', async () => {
      setEnv({ API_INTERNAL_URL: 'http://bazionweb-api:4000' });
      global.fetch = jest.fn().mockResolvedValue(
        new Response('{"message":"Forbidden"}', {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
      ) as unknown as typeof fetch;

      const res = await gatewayGet(gatewayRequest('admin/x'), { params: { path: ['admin', 'x'] } });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ message: 'Forbidden' });
    });
  });
});

