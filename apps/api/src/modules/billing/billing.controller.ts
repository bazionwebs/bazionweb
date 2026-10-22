import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request, 
  ParseUUIDPipe 
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard, Roles, Public } from '../../common/guards/jwt-auth.guard';
import { MfaGuard } from '../../common/guards/mfa.guard';
import { MpesaSubscriptionDto, PaystackSubscriptionDto, BankTransferInvoiceDto, GuestSubscriptionDto, GuestMpesaSubscriptionDto, GuestBankTransferInvoiceDto } from './dto/billing.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MfaGuard)
@Controller({ path: 'invoices', version: '1' })
export class BillingController {
  constructor(private readonly svc: BillingService) {}

  /**
   * Guest checkout (Track C) — pay-first, no account required.
   * Public because the customer has no login yet; the webhook activates
   * the subscription and the claim endpoint creates the credentials after.
   * Throttled hard: anonymous, billing-critical.
   */
  @Post('guest/subscribe/paystack')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Guest Paystack card checkout (KES/USD) — pay before signup' })
  subscribePaystackGuest(@Body() body: GuestSubscriptionDto) {
    return this.svc.subscribePaystackGuest(body);
  }

  /**
   * Guest M-Pesa (Track C) — Paystack STK Push before signup, no account required.
   * Same public contract as guest card checkout; Paystack webhook activates on success.
   */
  @Post('guest/subscribe/mpesa')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Guest M-Pesa STK checkout via Paystack (KES) — pay before signup' })
  subscribeMpesaGuest(@Body() body: GuestMpesaSubscriptionDto) {
    return this.svc.subscribeMpesaGuest(body);
  }

  /**
   * Guest B2B invoice (Track C) — corporate wire intent without an account.
   * Generates identity + invoice + manual settlement details only.
   */
  @Post('guest/corporate-invoice/bank-transfer')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Guest B2B bank-transfer invoice — no account required' })
  createBankTransferInvoiceGuest(@Body() body: GuestBankTransferInvoiceDto) {
    return this.svc.createBankTransferInvoiceGuest(body);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices (scoped by role)' })
  findAll(
    @Request() req: any,
    @Query('scope') scope?: string,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.findAll(req.user, { scope, status, page: +page, limit: +limit });
  }

  @Post('subscribe/mpesa')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Initialize M-Pesa STK Push via Daraja / Paystack (KES)' })
  subscribeMpesa(@Request() req: any, @Body() body: MpesaSubscriptionDto) {
    return this.svc.subscribeMpesa(req.user, body);
  }

  @Get('mpesa/query/:checkoutRequestId')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Query Safaricom Daraja STK Push transaction status' })
  queryMpesaStatus(@Param('checkoutRequestId') checkoutRequestId: string) {
    return this.svc.queryMpesaStatus(checkoutRequestId);
  }

  @Post('subscribe/paystack')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Initialize Paystack card checkout (KES/USD) — server-side pricing' })
  subscribePaystack(@Request() req: any, @Body() body: PaystackSubscriptionDto) {
    return this.svc.subscribePaystack(req.user, body);
  }

  @Post('corporate-invoice/bank-transfer')
  @ApiOperation({ summary: 'Generate B2B invoice with manual bank-transfer details' })
  createBankTransferInvoice(@Request() req: any, @Body() body: BankTransferInvoiceDto) {
    return this.svc.createBankTransferInvoice(req.user, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.svc.findOne(id, req.user);
  }

  @Post('generate')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Manually generate invoice (admin)' })
  generate(@Body() body: { clientId: string; subscriptionId?: string; amount: number; notes?: string }) {
    return this.svc.generate(body);
  }

  @Patch(':id/mark-paid')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Mark invoice as paid (admin)' })
  markPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markPaid(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Get PDF download URL for invoice' })
  getPdf(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.svc.getPdfUrl(id, req.user);
  }
}
