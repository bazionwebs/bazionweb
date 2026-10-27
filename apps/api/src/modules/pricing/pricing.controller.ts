import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingAuditService } from './pricing-audit.service';
import {
  CalculateQuoteDto,
  UpsertPriceDto,
  CreatePriceBookDto,
  UpsertTaxRuleDto,
  UpsertAdjustmentDto,
} from './pricing.dto';
import { JwtAuthGuard, Roles } from '../../common/guards/jwt-auth.guard';
import { MfaGuard, RequireMfa } from '../../common/guards/mfa.guard';
import { Throttle } from '@nestjs/throttler';

@Controller({ path: 'pricing', version: '1' })
export class PricingController {
  constructor(
    private readonly pricingService: PricingService,
    private readonly auditService: PricingAuditService,
  ) {}

  /**
   * Public: Retrieve active commercial markets.
   */
  @Get('markets')
  async getMarkets() {
    return this.pricingService.getActiveMarkets();
  }

  /**
   * Public: Retrieve full pricing catalog for a specific market directly from DB.
   */
  @Get('catalog')
  async getCatalog(@Query('market') market: string) {
    return this.pricingService.getCatalog(market || 'KE');
  }

  /**
   * Public: Authoritative real-time quote calculation.
   * Pulls base rates, add-on rates, tax rules, and coupons exclusively from PostgreSQL.
   */
  @Post('quote')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async calculateQuote(@Body() dto: CalculateQuoteDto) {
    return this.pricingService.calculateQuote(dto);
  }

  /**
   * Protected: Admin view of append-only pricing audit logs.
   */
  @Get('audit')
  @UseGuards(JwtAuthGuard, MfaGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @RequireMfa()
  async getAuditHistory(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.getAuditHistory({
      entityType,
      entityId,
      limit: limit ? Number(limit) : 50,
    });
  }

  /**
   * Protected: Admin mutation of product price in a price book with audit trail.
   */
  @Post('admin/price')
  @UseGuards(JwtAuthGuard, MfaGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @RequireMfa()
  async upsertPrice(@Req() req: any, @Body() dto: UpsertPriceDto) {
    const adminUserId = req.user?.id || 'system-admin';
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.pricingService.upsertPrice(adminUserId, dto, { ip, userAgent });
  }

  /**
   * Protected: Admin creation of a new versioned price book.
   */
  @Post('admin/price-book')
  @UseGuards(JwtAuthGuard, MfaGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @RequireMfa()
  async createPriceBook(@Req() req: any, @Body() dto: CreatePriceBookDto) {
    const adminUserId = req.user?.id || 'system-admin';
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.pricingService.createPriceBook(adminUserId, dto, { ip, userAgent });
  }

  /**
   * Protected: Admin mutation of tax rules.
   */
  @Post('admin/tax-rule')
  @UseGuards(JwtAuthGuard, MfaGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @RequireMfa()
  async upsertTaxRule(@Req() req: any, @Body() dto: UpsertTaxRuleDto) {
    const adminUserId = req.user?.id || 'system-admin';
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.pricingService.upsertTaxRule(adminUserId, dto, { ip, userAgent });
  }

  /**
   * Protected: Admin mutation of market adjustments and coupons.
   */
  @Post('admin/adjustment')
  @UseGuards(JwtAuthGuard, MfaGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @RequireMfa()
  async upsertAdjustment(@Req() req: any, @Body() dto: UpsertAdjustmentDto) {
    const adminUserId = req.user?.id || 'system-admin';
    const ip = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.pricingService.upsertAdjustment(adminUserId, dto, { ip, userAgent });
  }
}
