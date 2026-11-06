import { IsEmail, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, IsArray, ArrayMaxSize, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from '@prisma/client';
import { Type } from 'class-transformer';

/** One catalog add-on line in a cart checkout. Prices are ALWAYS resolved
 *  server-side from the active price book — the client only sends identity. */
export class CartExtraDto {
  @ApiProperty({ description: 'Price-book product ID, e.g. hosting-starter or addon-seo' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\w-]{2,64}$/, { message: 'Invalid product ID' })
  productId: string;

  @ApiProperty({ description: 'Quantity (1-10)' })
  @IsInt()
  @Min(1)
  @Max(10)
  qty: number;
}

export class MpesaSubscriptionDto {
  @ApiProperty({ description: 'Plan ID to subscribe to' })
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ enum: BillingCycle, description: 'Billing cycle: MONTHLY or ANNUAL' })
  @IsEnum(BillingCycle)
  @IsNotEmpty()
  billingCycle: BillingCycle;

  @ApiProperty({ description: 'M-Pesa phone number, e.g. 254712345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+?254|0)?[17]\d{8}$/, { message: 'Valid Safaricom phone number required' })
  mpesaPhoneNumber: string;
  @ApiPropertyOptional({ type: [CartExtraDto], description: 'Catalog add-ons to bill with the first invoice (server-priced)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CartExtraDto)
  extras?: CartExtraDto[];

}

export class PaystackSubscriptionDto {
  @ApiProperty({ description: 'Plan ID to subscribe to' })
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ enum: BillingCycle })
  @IsEnum(BillingCycle)
  @IsNotEmpty()
  billingCycle: BillingCycle;

  @ApiProperty({ enum: ['KES', 'USD'], description: 'Charge currency — cards only' })
  @IsEnum(['KES', 'USD'])
  @IsNotEmpty()
  currency: 'KES' | 'USD';

  @ApiPropertyOptional({ description: 'Receipt email (defaults to client email)' })
  @IsOptional()
  @IsEmail()
  email?: string;
  @ApiPropertyOptional({ type: [CartExtraDto], description: 'Catalog add-ons to bill with the first invoice (server-priced)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CartExtraDto)
  extras?: CartExtraDto[];

}

/** Pay an existing (PENDING/OVERDUE) invoice with an M-Pesa STK Push. */
export class PayInvoiceMpesaDto {
  @ApiProperty({ description: 'M-Pesa phone number, e.g. 254712345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+?254|0)?[17]\d{8}$/, { message: 'Valid Safaricom phone number required' })
  mpesaPhoneNumber: string;
}

/** Confirm a Paystack transaction from the hosted-checkout return URL. */
export class ConfirmPaystackDto {
  @ApiProperty({ description: 'Paystack transaction reference from the callback URL' })
  @IsString()
  @IsNotEmpty()
  reference: string;
}

/** Pay an existing (PENDING/OVERDUE) invoice by card via a Paystack redirect. */
export class PayInvoiceCardDto {
  @ApiPropertyOptional({ description: 'Receipt email (defaults to client email)' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class BankTransferInvoiceDto {
  @ApiProperty({ description: 'Plan ID to invoice for' })
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ enum: BillingCycle, description: 'Billing cycle: MONTHLY or ANNUAL' })
  @IsEnum(BillingCycle)
  @IsNotEmpty()
  billingCycle: BillingCycle;

  @ApiProperty({ enum: ['USD', 'EUR', 'GBP', 'KES'], description: 'Settlement currency' })
  @IsEnum(['USD', 'EUR', 'GBP', 'KES'])
  @IsNotEmpty()
  currency: 'USD' | 'EUR' | 'GBP' | 'KES';

  @ApiPropertyOptional({ description: 'Client Purchase Order Number / Internal Billing Code' })
  @IsOptional()
  @IsString()
  purchaseOrderNumber?: string;
}

/**
 * Pay-first guest M-Pesa checkout — Paystack STK Push before signup.
 * Names are optional so the coupon-light form only needs email + phone;
 * claim-account later fills the real identity.
 */
export class GuestMpesaSubscriptionDto {
  @ApiProperty({ description: 'Plan ID to subscribe to' })
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ enum: BillingCycle, description: 'Billing cycle: MONTHLY or ANNUAL' })
  @IsEnum(BillingCycle)
  @IsNotEmpty()
  billingCycle: BillingCycle;

  @ApiProperty({ description: 'Billing email — doubles as the account claim identity' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'M-Pesa phone number, e.g. 254712345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+?254|0)?[17]\d{8}$/, { message: 'Valid Safaricom phone number required' })
  mpesaPhoneNumber: string;

  @ApiPropertyOptional({ description: 'Customer first name (defaults to a placeholder until claim)' })
  @IsOptional()
  @IsString()
  @Matches(/^.{1,64}$/, { message: 'First name must be 1-64 characters' })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Customer last name' })
  @IsOptional()
  @IsString()
  @Matches(/^.{1,64}$/, { message: 'Last name must be 1-64 characters' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Business / organisation name' })
  @IsOptional()
  @IsString()
  @Matches(/^.{1,120}$/, { message: 'Business name must be 1-120 characters' })
  businessName?: string;
  @ApiPropertyOptional({ type: [CartExtraDto], description: 'Catalog add-ons to bill with the first invoice (server-priced)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CartExtraDto)
  extras?: CartExtraDto[];

}

/**
 * Pay-first guest B2B bank-transfer invoice — corporate wire intent without
 * an account. Activation remains manual (admin confirms the wire), so this
 * generates identity + invoice + settlement instructions only.
 */
export class GuestBankTransferInvoiceDto {
  @ApiProperty({ description: 'Plan ID to invoice for' })
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ enum: BillingCycle, description: 'Billing cycle: MONTHLY or ANNUAL' })
  @IsEnum(BillingCycle)
  @IsNotEmpty()
  billingCycle: BillingCycle;

  @ApiProperty({ enum: ['USD', 'EUR', 'GBP', 'KES'], description: 'Settlement currency' })
  @IsEnum(['USD', 'EUR', 'GBP', 'KES'])
  @IsNotEmpty()
  currency: 'USD' | 'EUR' | 'GBP' | 'KES';

  @ApiProperty({ description: 'Billing email — doubles as the account claim identity' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ description: 'Customer first name' })
  @IsOptional()
  @IsString()
  @Matches(/^.{1,64}$/, { message: 'First name must be 1-64 characters' })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Customer last name' })
  @IsOptional()
  @IsString()
  @Matches(/^.{1,64}$/, { message: 'Last name must be 1-64 characters' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Business / organisation name' })
  @IsOptional()
  @IsString()
  @Matches(/^.{1,120}$/, { message: 'Business name must be 1-120 characters' })
  businessName?: string;

  @ApiPropertyOptional({ description: 'Phone number, e.g. +254712345678' })
  @IsOptional()
  @IsString()
  @Matches(/^(\+?\d{7,15})$/, { message: 'Valid phone number required' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Client Purchase Order Number / Internal Billing Code' })
  @IsOptional()
  @IsString()
  purchaseOrderNumber?: string;
}

/**
 * Pay-first guest checkout — no account required before payment.
 * The payment email later claims the account in one step
 * (POST /auth/claim-account) once the webhook confirms the charge.
 */
export class GuestSubscriptionDto {
  @ApiProperty({ description: 'Plan ID to subscribe to' })
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ enum: BillingCycle, description: 'Billing cycle: MONTHLY or ANNUAL' })
  @IsEnum(BillingCycle)
  @IsNotEmpty()
  billingCycle: BillingCycle;

  @ApiProperty({ enum: ['KES', 'USD'], description: 'Charge currency — cards only' })
  @IsEnum(['KES', 'USD'])
  @IsNotEmpty()
  currency: 'KES' | 'USD';

  @ApiProperty({ description: 'Billing email — doubles as the account claim identity' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Customer first name' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^.{1,64}$/, { message: 'First name must be 1-64 characters' })
  firstName: string;

  @ApiProperty({ description: 'Customer last name' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^.{1,64}$/, { message: 'Last name must be 1-64 characters' })
  lastName: string;

  @ApiPropertyOptional({ description: 'Business / organisation name' })
  @IsOptional()
  @IsString()
  @Matches(/^.{1,120}$/, { message: 'Business name must be 1-120 characters' })
  businessName?: string;

  @ApiPropertyOptional({ description: 'Phone number, e.g. +254712345678' })
  @IsOptional()
  @IsString()
  @Matches(/^(\+?\d{7,15})$/, { message: 'Valid phone number required' })
  phone?: string;
  @ApiPropertyOptional({ type: [CartExtraDto], description: 'Catalog add-ons to bill with the first invoice (server-priced)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CartExtraDto)
  extras?: CartExtraDto[];

}

// ─── Proposal → deposit checkout (quote-to-close) ────────────────────────────

/** Accept a locked proposal and create the kickoff-deposit invoice (guest). */
export class AcceptProposalDto {
  @ApiProperty({ description: 'Proposal reference code, e.g. BZ-KE-2026-0U9UI' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'Billing email (defaults to the proposal email)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Customer first name' })
  @IsOptional()
  @IsString()
  @Matches(/^.{1,64}$/, { message: 'First name must be 1-64 characters' })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Customer last name' })
  @IsOptional()
  @IsString()
  @Matches(/^.{1,64}$/, { message: 'Last name must be 1-64 characters' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Business / organisation name' })
  @IsOptional()
  @IsString()
  @Matches(/^.{1,120}$/, { message: 'Business name must be 1-120 characters' })
  businessName?: string;

  @ApiPropertyOptional({ description: 'Phone number, e.g. +254712345678' })
  @IsOptional()
  @IsString()
  @Matches(/^(\+?\d{7,15})$/, { message: 'Valid phone number required' })
  phone?: string;
}

/** Pay an accepted proposal's kickoff deposit with a card (Paystack hosted checkout). */
export class ProposalDepositCardDto {
  @ApiPropertyOptional({ description: 'Receipt email (defaults to the proposal email)' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

/** Pay an accepted proposal's kickoff deposit with an M-Pesa STK Push (KES only). */
export class ProposalDepositMpesaDto {
  @ApiProperty({ description: 'M-Pesa phone number, e.g. 254712345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+?254|0)?[17]\d{8}$/, { message: 'Valid Safaricom phone number required' })
  mpesaPhoneNumber: string;
}

export class ProposalLineItemResponseDto {
  @ApiProperty({ description: 'Line item title or product name' })
  title: string;

  @ApiPropertyOptional({ description: 'Subtitle or period description' })
  subtitle?: string;

  @ApiProperty({ description: 'Line item unit or total price' })
  price: number;

  @ApiPropertyOptional({ description: 'Quantity (if applicable)' })
  quantity?: number;
}

export class ProposalLinkedInvoiceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  invoiceNumber: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  dueDate: string;
}

export class ProposalDetailsDto {
  @ApiProperty({ example: 'BZ-KE-2026-ABC12' })
  proposalCode: string;

  @ApiProperty({ example: 'KES' })
  currency: string;

  @ApiProperty({ example: 'KSh' })
  currencySymbol: string;

  @ApiProperty({ example: 90000 })
  totalAmount: number;

  @ApiProperty({ example: 45000 })
  depositAmount: number;

  @ApiProperty({ example: 45000 })
  finalAmount: number;

  @ApiProperty({ enum: ['LOCKED', 'ACCEPTED', 'EXPIRED'], example: 'LOCKED' })
  status: 'LOCKED' | 'ACCEPTED' | 'EXPIRED';

  @ApiProperty({ example: 'Jane Wanjiku' })
  clientName: string;

  @ApiProperty({ example: 'Acacia Healthcare Ltd' })
  clientCompany: string;

  @ApiProperty({ example: 'jane@acacia.co.ke' })
  clientEmail: string;

  @ApiProperty({ enum: ['KE', 'GLOBAL'], example: 'KE' })
  marketCode: 'KE' | 'GLOBAL';

  @ApiProperty({ type: [ProposalLineItemResponseDto] })
  lineItems: ProposalLineItemResponseDto[];

  @ApiProperty({ example: '2026-12-01T00:00:00.000Z' })
  expiresAt: string;

  @ApiProperty({ example: '2026-11-01T00:00:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({ type: ProposalLinkedInvoiceDto })
  invoice?: ProposalLinkedInvoiceDto;
}

/** Itemized service line item for invoices. */
export class InvoiceLineItemDto {
  @ApiProperty({ description: 'Service or line item description', example: 'Launch Website Package' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @ApiPropertyOptional({ description: 'Quantity (>= 1)', example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Unit price', example: 450 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Total line amount', example: 450 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

/** Manually generate an invoice (admin). */
export class GenerateInvoiceDto {
  @ApiProperty({ description: 'Target client UUID' })
  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @ApiPropertyOptional({ description: 'Optional linked subscription UUID' })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiProperty({ description: 'Invoice total amount (> 0)' })
  @IsNumber()
  @Min(0.01)
  @Max(5_000_000)
  amount: number;

  @ApiPropertyOptional({ enum: ['USD', 'KES', 'EUR', 'GBP'] })
  @IsOptional()
  @IsIn(['USD', 'KES', 'EUR', 'GBP'])
  currency?: 'USD' | 'KES' | 'EUR' | 'GBP';

  @ApiPropertyOptional({ description: 'Due date in ISO format' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ type: [InvoiceLineItemDto], description: 'Itemized service line items' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems?: InvoiceLineItemDto[];

  @ApiPropertyOptional({ description: 'Invoice notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
