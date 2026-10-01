import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from '@prisma/client';

export class IntaSendSubscriptionDto {
  @ApiProperty({ description: 'Plan ID to subscribe to' })
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ enum: BillingCycle, description: 'Billing cycle: MONTHLY or ANNUAL' })
  @IsEnum(BillingCycle)
  @IsNotEmpty()
  billingCycle: BillingCycle;

  @ApiProperty({ enum: ['MPESA'], description: 'Payment method rail — M-Pesa via IntaSend STK' })
  @IsEnum(['MPESA'])
  @IsNotEmpty()
  paymentMethod: 'MPESA';

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

/** @deprecated Use BankTransferInvoiceDto — kept for backwards compat */
export class WiseCorporateInvoiceDto extends BankTransferInvoiceDto {}
