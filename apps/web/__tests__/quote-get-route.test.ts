/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/quote/route';

describe('Next.js BFF Route Handler — GET /api/quote (Proposal Retrieval)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('returns 400 Bad Request when proposal code is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/quote');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/code is required/i);
  });

  it('returns 404 when proposal code contains malicious or invalid characters', async () => {
    const maliciousUrls = [
      'http://localhost:3000/api/quote?code=bad<script>',
      'http://localhost:3000/api/quote?code=AB', // too short (< 4 chars)
      'http://localhost:3000/api/quote?code=QUOTE;DROP TABLE',
    ];

    for (const url of maliciousUrls) {
      const req = new NextRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    }
  });

  it('forwards 200 JSON response when backend returns proposal details', async () => {
    const backendPayload = {
      success: true,
      data: {
        proposalCode: 'BZ-KE-2026-TEST1',
        currency: 'KES',
        currencySymbol: 'KSh',
        totalAmount: 180000,
        depositAmount: 90000,
        finalAmount: 90000,
        status: 'LOCKED',
        clientName: 'Wanjiku Test',
        clientEmail: 'wanjiku@test.co.ke',
        marketCode: 'KE',
        lineItems: [
          { title: 'Business Digital Flagship', price: 150000, quantity: 1 },
        ],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(backendPayload),
    });

    const req = new NextRequest('http://localhost:3000/api/quote?code=bz-ke-2026-test1');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.proposalCode).toBe('BZ-KE-2026-TEST1');
    expect(body.data.currency).toBe('KES');
  });

  it('forwards 404 when backend returns 404 and cache is empty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValue({ success: false, message: 'Not found' }),
    });

    const req = new NextRequest('http://localhost:3000/api/quote?code=BZ-KE-UNKNOWN-999');
    const res = await GET(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('forwards 429 when backend rate limits request', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: jest.fn().mockResolvedValue({ success: false, message: 'Too many requests' }),
    });

    const req = new NextRequest('http://localhost:3000/api/quote?code=BZ-KE-2026-THROT1');
    const res = await GET(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/rate limit/i);
  });

  it('falls back to local cache when backend experiences network failure after cached save', async () => {
    const cachedCode = 'BZ-KE-2026-CACHE1';
    const mockProposal = {
      proposalCode: cachedCode,
      currency: 'KES',
      currencySymbol: 'KSh',
      totalAmount: 120000,
      depositAmount: 60000,
      finalAmount: 60000,
      status: 'LOCKED',
      clientName: 'Cache User',
      clientEmail: 'cache@test.com',
      marketCode: 'KE',
    };

    // First call: Successful backend fetch populates cache
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true, data: mockProposal }),
    });

    const req1 = new NextRequest(`http://localhost:3000/api/quote?code=${cachedCode}`);
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);

    // Second call: Backend goes offline (network timeout or connection refused)
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED: Backend offline'));

    const req2 = new NextRequest(`http://localhost:3000/api/quote?code=${cachedCode}`);
    const res2 = await GET(req2);

    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(body2.data.proposalCode).toBe(cachedCode);
    expect(body2._source).toBe('cache_fallback');
  });

  it('accepts ?proposal= query parameter alias', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: { proposalCode: 'BZ-KE-2026-ALIAS1' },
      }),
    });

    const req = new NextRequest('http://localhost:3000/api/quote?proposal=BZ-KE-2026-ALIAS1');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.proposalCode).toBe('BZ-KE-2026-ALIAS1');
  });
});
