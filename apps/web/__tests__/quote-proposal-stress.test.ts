/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/quote/route';
import {
  saveProposalToLocalCache,
  getProposalFromLocalCache,
  clearProposalLocalCache,
} from '@/lib/proposal-cache';

describe('Adversarial Stress Test: Next.js BFF GET /api/quote', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearProposalLocalCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearProposalLocalCache();
  });

  describe('1. Adversarial Query Parameters & Injection Attempts', () => {
    const maliciousCodes = [
      // SQL Injections
      "' OR '1'='1",
      "'; DROP TABLE proposals; --",
      "admin'--",
      "UNION SELECT 1,2,3",

      // XSS & Markup
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "javascript:alert(1)",

      // Path Traversal & File System
      "../../etc/passwd",
      "..\\..\\windows\\win.ini",
      "%2e%2e%2f",

      // Control characters & Null bytes
      "BZ\0KE-2026",
      "BZ\r\nKE",
      "BZ\tKE",

      // Punctuation & URL operators
      "BZ KE 2026",
      "BZ?param=val",
      "BZ#hash",
      "BZ/2026",

      // Length boundary violations
      "A", // 1 char
      "AB", // 2 chars
      "ABC", // 3 chars (< 4)
      "A".repeat(65), // 65 chars (> 64)
      "A".repeat(500), // Buffer bloat
    ];

    maliciousCodes.forEach((badCode) => {
      it(`blocks adversarial code "${badCode.slice(0, 25)}" with HTTP 404 without calling upstream backend`, async () => {
        const mockBackend = jest.fn();
        global.fetch = mockBackend;

        const req = new NextRequest(`http://localhost:3000/api/quote?code=${encodeURIComponent(badCode)}`);
        const res = await GET(req);

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toMatch(/invalid format|not found/i);
        expect(mockBackend).not.toHaveBeenCalled();
      });
    });

    it('returns HTTP 400 Bad Request if both code and proposal params are missing or whitespace', async () => {
      const emptyUrls = [
        'http://localhost:3000/api/quote',
        'http://localhost:3000/api/quote?code=',
        'http://localhost:3000/api/quote?code=   ',
        'http://localhost:3000/api/quote?proposal=',
        'http://localhost:3000/api/quote?proposal=   ',
      ];

      for (const url of emptyUrls) {
        const req = new NextRequest(url);
        const res = await GET(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toMatch(/required/i);
      }
    });

    it('normalizes lowercase valid codes to uppercase before querying backend', async () => {
      let requestedUrl = '';
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        requestedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { proposalCode: 'BZ-KE-2026-LOWER' } }),
        };
      });

      const req = new NextRequest('http://localhost:3000/api/quote?code=bz-ke-2026-lower');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(requestedUrl).toContain('BZ-KE-2026-LOWER');
    });

    it('respects parameter precedence when both code and proposal are present', async () => {
      let requestedUrl = '';
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        requestedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { proposalCode: 'BZ-KE-PRIMARY' } }),
        };
      });

      const req = new NextRequest('http://localhost:3000/api/quote?code=BZ-KE-PRIMARY&proposal=BZ-KE-SECONDARY');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(requestedUrl).toContain('BZ-KE-PRIMARY');
      expect(requestedUrl).not.toContain('BZ-KE-SECONDARY');
    });
  });

  describe('2. Rate Limiting (429) & Upstream Status Forwarding', () => {
    it('accurately forwards upstream HTTP 429 Too Many Requests response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ message: 'ThrottlerException: Too Many Requests' }),
      });

      const req = new NextRequest('http://localhost:3000/api/quote?code=BZ-KE-2026-RATE');
      const res = await GET(req);

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/rate limit exceeded/i);
    });

    it('forwards 404 when upstream returns 404 and cache is cold', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Proposal not found' }),
      });

      const req = new NextRequest('http://localhost:3000/api/quote?code=BZ-KE-2026-NOTFOUND');
      const res = await GET(req);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Proposal not found');
    });
  });

  describe('3. In-Memory Cache Resilience Under Backend Unavailability', () => {
    const cachedProposal = {
      proposalCode: 'BZ-KE-2026-RESILIENT',
      currency: 'KES',
      currencySymbol: 'KSh',
      totalAmount: 180000,
      depositAmount: 90000,
      finalAmount: 90000,
      status: 'LOCKED',
      clientName: 'Resilient Client',
      clientEmail: 'client@resilient.com',
      marketCode: 'KE',
      lineItems: [{ title: 'Turnkey Suite', price: 180000 }],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    it('serves cached proposal with _source: cache_fallback when backend is ECONNREFUSED', async () => {
      saveProposalToLocalCache('BZ-KE-2026-RESILIENT', cachedProposal);

      global.fetch = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:4000'));

      const req = new NextRequest('http://localhost:3000/api/quote?code=BZ-KE-2026-RESILIENT');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body._source).toBe('cache_fallback');
      expect(body.data.proposalCode).toBe('BZ-KE-2026-RESILIENT');
      expect(body.data.totalAmount).toBe(180000);
    });

    it('serves cached proposal when backend fetch times out (AbortSignal timeout)', async () => {
      saveProposalToLocalCache('BZ-KE-2026-RESILIENT', cachedProposal);

      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'TimeoutError';
      global.fetch = jest.fn().mockRejectedValue(timeoutError);

      const req = new NextRequest('http://localhost:3000/api/quote?code=BZ-KE-2026-RESILIENT');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body._source).toBe('cache_fallback');
      expect(body.data.proposalCode).toBe('BZ-KE-2026-RESILIENT');
    });

    it('serves cached proposal when backend returns HTTP 500 or 503 Internal Server Error / Service Unavailable', async () => {
      saveProposalToLocalCache('BZ-KE-2026-RESILIENT', cachedProposal);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service Unavailable' }),
      });

      const req = new NextRequest('http://localhost:3000/api/quote?code=BZ-KE-2026-RESILIENT');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body._source).toBe('cache_fallback');
      expect(body.data.proposalCode).toBe('BZ-KE-2026-RESILIENT');
    });

    it('returns HTTP 404 if backend is offline and cache is empty', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const req = new NextRequest('http://localhost:3000/api/quote?code=BZ-KE-2026-COLD');
      const res = await GET(req);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/temporarily unavailable/i);
    });
  });

  describe('4. In-Memory Cache TTL Expiration & LRU Capacity Eviction', () => {
    it('evicts entries older than 24 hours (CACHE_TTL_MS)', () => {
      const code = 'BZ-KE-2026-EXPIRING';
      const sample = { proposalCode: code, totalAmount: 50000 };

      saveProposalToLocalCache(code, sample);
      expect(getProposalFromLocalCache(code)).toEqual(sample);

      // Fast forward time past 24 hours (24 * 60 * 60 * 1000 + 1)
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 86400000 + 1000);

      const expiredResult = getProposalFromLocalCache(code);
      expect(expiredResult).toBeNull();

      nowSpy.mockRestore();
    });

    it('strictly caps cache size at 500 entries, evicting the oldest entry on insertion #501', () => {
      // Insert 500 entries
      for (let i = 1; i <= 500; i++) {
        saveProposalToLocalCache(`BZ-TEST-${i}`, { proposalCode: `BZ-TEST-${i}`, idx: i });
      }

      // Verify entry 1 exists
      expect(getProposalFromLocalCache('BZ-TEST-1')).toBeDefined();

      // Insert 501st entry
      saveProposalToLocalCache('BZ-TEST-501', { proposalCode: 'BZ-TEST-501', idx: 501 });

      // Entry 1 (oldest) must have been evicted to respect memory constraint
      expect(getProposalFromLocalCache('BZ-TEST-1')).toBeNull();

      // Entry 2 and 501 must be retained
      expect(getProposalFromLocalCache('BZ-TEST-2')).toBeDefined();
      expect(getProposalFromLocalCache('BZ-TEST-501')).toBeDefined();
    });

    it('case-insensitively accesses cached proposals', () => {
      saveProposalToLocalCache('bz-lower-key', { proposalCode: 'BZ-LOWER-KEY' });
      expect(getProposalFromLocalCache('BZ-LOWER-KEY')).toBeDefined();
      expect(getProposalFromLocalCache('bz-lower-key')).toBeDefined();
    });
  });
});
