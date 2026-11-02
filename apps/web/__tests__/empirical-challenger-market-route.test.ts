/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/market/route';

describe('Empirical Challenger: /api/market Route Handler Invocations & Security', () => {
  describe('POST /api/market Arity & Type Permutations', () => {
    it('1. Invoking POST with 0 arguments returns HTTP 403 Forbidden with isLocked: true', async () => {
      // Cast to function to simulate runtime 0-argument invocation
      const postFn = POST as unknown as () => ReturnType<typeof POST>;
      const response = await postFn();

      expect(response).toBeDefined();
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.isLocked).toBe(true);
      expect(json.error).toMatch(/manual market switching is disabled/i);
    });

    it('2. Invoking POST with 1 argument (undefined) returns HTTP 403 Forbidden with isLocked: true', async () => {
      const response = await POST(undefined as unknown as NextRequest);

      expect(response).toBeDefined();
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.isLocked).toBe(true);
      expect(json.error).toMatch(/manual market switching is disabled/i);
    });

    it('3. Invoking POST with 1 argument (null) returns HTTP 403 Forbidden with isLocked: true', async () => {
      const response = await POST(null as unknown as NextRequest);

      expect(response).toBeDefined();
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.isLocked).toBe(true);
      expect(json.error).toMatch(/manual market switching is disabled/i);
    });

    it('4. Invoking POST with empty plain object returns HTTP 403 Forbidden with isLocked: true', async () => {
      const response = await POST({} as unknown as NextRequest);

      expect(response).toBeDefined();
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.isLocked).toBe(true);
      expect(json.error).toMatch(/manual market switching is disabled/i);
    });

    it('5. Invoking POST with mock request object containing malicious payload returns HTTP 403 Forbidden', async () => {
      const mockReq = {
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ market: 'KE', override: true, admin: true }),
        url: 'http://localhost:3000/api/market?force=KE',
      };

      const response = await POST(mockReq as unknown as NextRequest);

      expect(response).toBeDefined();
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.isLocked).toBe(true);
      expect(json.error).toMatch(/manual market switching is disabled/i);
    });

    it('6. Invoking POST with standard global Request instance returns HTTP 403 Forbidden', async () => {
      const standardReq = new Request('http://localhost:3000/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: 'KE' }),
      });

      const response = await POST(standardReq as unknown as NextRequest);

      expect(response).toBeDefined();
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.isLocked).toBe(true);
      expect(json.error).toMatch(/manual market switching is disabled/i);
    });

    it('7. Invoking POST with NextRequest instance containing payload returns HTTP 403 Forbidden', async () => {
      const nextReq = new NextRequest('http://localhost:3000/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: 'GLOBAL' }),
      });

      const response = await POST(nextReq);

      expect(response).toBeDefined();
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.isLocked).toBe(true);
      expect(json.error).toMatch(/manual market switching is disabled/i);
    });

    it('8. Invoking POST with NextRequest instance with query overrides returns HTTP 403 Forbidden', async () => {
      const nextReq = new NextRequest('http://localhost:3000/api/market?market=KE&currency=KES', {
        method: 'POST',
      });

      const response = await POST(nextReq);

      expect(response).toBeDefined();
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.isLocked).toBe(true);
      expect(json.error).toMatch(/manual market switching is disabled/i);
    });
  });

  describe('GET /api/market Baseline Verification', () => {
    it('resolves KE market from cf-ipcountry header', async () => {
      const req = new NextRequest('http://localhost:3000/api/market', {
        headers: { 'cf-ipcountry': 'KE' },
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.market).toBe('KE');
      expect(json.currency).toBe('KES');
      expect(json.isLocked).toBe(true);
    });

    it('resolves GLOBAL market from US cf-ipcountry header and ignores query overrides', async () => {
      const req = new NextRequest('http://localhost:3000/api/market?market=KE', {
        headers: { 'cf-ipcountry': 'US' },
      });

      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.market).toBe('GLOBAL');
      expect(json.currency).toBe('USD');
      expect(json.isLocked).toBe(true);
    });
  });
});
