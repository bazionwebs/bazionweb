import { Test, TestingModule } from '@nestjs/testing';
import { QuotesService } from '../quotes.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockPrisma = { $connect: jest.fn(), $disconnect: jest.fn() };

describe('QuotesService', () => {
  let service: QuotesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<QuotesService>(QuotesService);
  });

  // ── calculate() ────────────────────────────────────────────────────────────

  describe('calculate()', () => {
    it('computes correct build cost for simple pages', () => {
      const result = service.calculate({
        pages: [{ type: 'simple' }, { type: 'simple' }],
        tier: 'starter',
      });
      expect(result.data.buildCost).toBe(300);        // 2 × $150
      expect(result.data.addOns.reduce((s,a) => s+a.cost, 0)).toBe(0);
      expect(result.data.monthly).toBe(49);
    });

    it('computes correct build cost for mixed pages', () => {
      const result = service.calculate({
        pages: [{ type: 'simple' }, { type: 'standard' }, { type: 'complex' }],
        tier: 'growth',
      });
      // 150 + 250 + 450 = 850
      expect(result.data.buildCost).toBe(850);
      expect(result.data.monthly).toBe(99);
    });

    it('adds CMS add-on correctly', () => {
      const result = service.calculate({
        pages: [{ type: 'simple' }],
        hasCms: true,
        tier: 'starter',
      });
      expect(result.data.buildCost).toBe(450);        // 150 + 300
      expect(result.data.addOns).toHaveLength(1);
      expect(result.data.addOns[0].name).toContain('CMS');
    });

    it('adds e-commerce add-on correctly', () => {
      const result = service.calculate({
        pages: [{ type: 'standard' }],
        hasEcommerce: true,
        tier: 'business',
      });
      expect(result.data.buildCost).toBe(1050);       // 250 + 800
      expect(result.data.monthly).toBe(199);
    });

    it('adds migration add-on correctly', () => {
      const result = service.calculate({
        pages: [{ type: 'simple' }],
        needsMigration: true,
        tier: 'starter',
      });
      expect(result.data.buildCost).toBe(300);        // 150 + 150
    });

    it('adds custom design add-on correctly', () => {
      const result = service.calculate({
        pages: [{ type: 'simple' }],
        customDesign: true,
        tier: 'growth',
      });
      expect(result.data.buildCost).toBe(550);        // 150 + 400
    });

    it('stacks multiple add-ons', () => {
      const result = service.calculate({
        pages: [{ type: 'complex' }],
        hasCms: true,
        hasEcommerce: true,
        needsMigration: true,
        customDesign: true,
        tier: 'business',
      });
      // 450 + 300 + 800 + 150 + 400 = 2100
      expect(result.data.buildCost).toBe(2100);
      expect(result.data.addOns).toHaveLength(4);
    });

    it('calculates annual saving correctly', () => {
      const result = service.calculate({
        pages: [{ type: 'simple' }],
        tier: 'growth',
      });
      expect(result.data.annualSaving).toBe(198);      // $99 × 2
      expect(result.data.annual).toBe(990);            // $99 × 10
    });

    it('calculates year-1 total correctly (monthly billing)', () => {
      const result = service.calculate({
        pages: [{ type: 'simple' }],        // $150
        tier: 'starter',                   // $49/mo
      });
      expect(result.data.year1Total).toBe(150 + 49 * 12);  // $738
    });

    it('returns custom note for enterprise tier', () => {
      const result = service.calculate({
        pages: [{ type: 'complex' }],
        tier: 'enterprise',
      });
      expect(result.data.note).toBeDefined();
      expect(result.data.monthly).toBe(0);
    });

    it('returns USD currency', () => {
      const result = service.calculate({ pages: [{ type: 'simple' }], tier: 'starter' });
      expect(result.data.currency).toBe('USD');
    });

    it('handles empty pages array gracefully', () => {
      const result = service.calculate({ pages: [], tier: 'starter' });
      expect(result.data.buildCost).toBe(0);
      expect(result.data.buildCost).toBe(0);
    });
  });

  // ── submit() ───────────────────────────────────────────────────────────────

  describe('submit()', () => {
    it('returns submitted: true', async () => {
      const result = await service.submit({
        name: 'Alice Wanjiku',
        email: 'alice@example.com',
        message: 'I need a new website for my clinic.',
        urgent: false,
      });
      expect(result.data.submitted).toBe(true);
    });

    it('returns a reference ID', async () => {
      const result = await service.submit({
        name: 'Bob Otieno',
        email: 'bob@example.com',
        message: 'We need managed hosting for 3 sites.',
        urgent: true,
      });
      expect(result.data.referenceId).toMatch(/^QR-/);
    });

    it('returns a confirmation message', async () => {
      const result = await service.submit({
        name: 'Carol Mutua',
        email: 'carol@example.com',
        message: 'Looking for a quote for security management.',
        urgent: false,
      });
      expect(result.data.message).toBeTruthy();
    });
  });
});
