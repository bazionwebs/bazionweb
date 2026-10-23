import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from '@prisma/client';

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
}

/** Pay an existing (PENDING/OVERDUE) invoice with an M-Pesa STK Push. */
export class PayInvoiceMpesaDto {
  @ApiProperty({ description: 'M-Pesa phone number, e.g. 254712345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+?254|0)?[17]\d{8}$/, { message: 'Valid Safaricom phone number required' })
  mpesaPhoneNumber: string;
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
}
