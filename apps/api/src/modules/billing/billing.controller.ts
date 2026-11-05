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
  Res,
  ParseUUIDPipe 
} from '@nestjs/common';

import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { PaymentSettlementService } from './payment-settlement.service';
import { JwtAuthGuard, Roles, Public } from '../../common/guards/jwt-auth.guard';
import { MfaGuard } from '../../common/guards/mfa.guard';
import { MpesaSubscriptionDto, PaystackSubscriptionDto, BankTransferInvoiceDto, GuestSubscriptionDto, GuestMpesaSubscriptionDto, GuestBankTransferInvoiceDto, PayInvoiceMpesaDto, PayInvoiceCardDto, ConfirmPaystackDto, AcceptProposalDto, ProposalDepositCardDto, ProposalDepositMpesaDto, GenerateInvoiceDto } from './dto/billing.dto';
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

  /**
   * Public: Retrieve proposal details by commercial reference code.
   * Throttled to 30 requests per minute to prevent scraping.
   */
  @Get('proposals/:code')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Retrieve commercial proposal by reference code (public)' })
  async getProposal(@Param('code') code: string) {
    return this.svc.getProposalByCode(code);
  }

  /**
   * Quote-to-close (Track C) — accept a locked proposal and get the kickoff
   * deposit invoice. Public because the proposer has no login yet; the
   * settlement webhook activates the client and the claim endpoint creates
   * the credentials after. Throttled hard: anonymous, billing-critical.
   */
  @Post('proposals/:code/accept')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Accept a locked proposal and create the kickoff deposit invoice' })
  acceptProposal(@Param('code') code: string, @Body() body: AcceptProposalDto) {
    return this.svc.acceptProposalGuest({ ...body, code });
  }

  @Post('proposals/:code/pay/card')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Pay a proposal kickoff deposit by card (Paystack hosted checkout)' })
  payProposalCard(@Param('code') code: string, @Body() body: ProposalDepositCardDto) {
    return this.svc.payProposalDepositCard(code, body);
  }

  @Post('proposals/:code/pay/mpesa')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Pay a proposal kickoff deposit via M-Pesa STK Push (KES)' })
  payProposalMpesa(@Param('code') code: string, @Body() body: ProposalDepositMpesaDto) {
    return this.svc.payProposalDepositMpesa(code, body);
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
  generate(@Body() body: GenerateInvoiceDto) {
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

  @Get(':id/pdf/download')
  @Public() // Authorized by a short-lived signed ?token= (minted by GET :id/pdf), deposit ?proposalCode=, or req.user
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Stream and download official invoice PDF (attachment)' })
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('token') token: string | undefined,
    @Query('proposalCode') proposalCode: string | undefined,
    @Request() req: any,
    @Res() res: any,
  ) {
    const { stream, filename } = await this.svc.generateInvoicePdfStream(id, {
      user: req?.user,
      token,
      proposalCode,
    });
    const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Length', stream.length);
    // The URL carries a bearer-style token: never cache it or leak it via Referer.
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.end(stream);
  }
}

