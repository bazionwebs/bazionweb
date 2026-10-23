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
import { PaymentSettlementService } from './payment-settlement.service';
import { JwtAuthGuard, Roles, Public } from '../../common/guards/jwt-auth.guard';
import { MfaGuard } from '../../common/guards/mfa.guard';
import { MpesaSubscriptionDto, PaystackSubscriptionDto, BankTransferInvoiceDto, GuestSubscriptionDto, GuestMpesaSubscriptionDto, GuestBankTransferInvoiceDto, PayInvoiceMpesaDto, PayInvoiceCardDto, ConfirmPaystackDto } from './dto/billing.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MfaGuard)
@Controller({ path: 'invoices', version: '1' })
export class BillingController {
  constructor(
    private readonly svc: BillingService,
    private readonly settlement: PaymentSettlementService,
  ) {}

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
  @ApiOperation({ summary: 'Query STK status for a checkout we initiated' })
  queryMpesaStatus(@Param('checkoutRequestId') checkoutRequestId: string) {
    return this.svc.queryMpesaStatus(checkoutRequestId);
  }

  /**
   * Return-URL confirmation — Paystack (and Stripe) recommend verifying the
   * transaction on the callback in addition to the webhook so the customer
   * is not stuck if the webhook is delayed.
   */
  @Post('confirm/paystack')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify a Paystack reference and settle the matching invoice' })
  confirmPaystack(@Body() body: ConfirmPaystackDto) {
    return this.settlement.confirmPaystackReference(body.reference);
  }

  @Get('payments/:ref/status')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Poll payment status for a checkout we initiated (no PII)' })
  paymentStatus(@Param('ref') ref: string) {
    return this.settlement.paymentStatus(ref);
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

  /**
   * Pay an existing PENDING/OVERDUE invoice via M-Pesa STK Push.
   * The webhook settles this exact invoice on success — no new invoice is
   * created, unlike the subscription rails above.
   */
  @Post(':id/pay/mpesa')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Settle an invoice by M-Pesa STK Push (KES invoices only)' })
  payInvoiceMpesa(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() body: PayInvoiceMpesaDto,
  ) {
    return this.svc.payInvoiceMpesa(req.user, id, body);
  }

  /**
   * Pay an existing PENDING/OVERDUE invoice by card — returns a Paystack
   * hosted-checkout redirect; the webhook settles this exact invoice.
   */
  @Post(':id/pay/card')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Settle an invoice by card via Paystack redirect (KES/USD)' })
  payInvoiceCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() body: PayInvoiceCardDto,
  ) {
    return this.svc.payInvoiceCard(req.user, id, body);
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
