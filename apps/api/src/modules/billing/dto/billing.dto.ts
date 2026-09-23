import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
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

  @ApiProperty({ enum: ['MPESA', 'CARD'], description: 'Payment method rail' })
  @IsEnum(['MPESA', 'CARD'])
  @IsNotEmpty()
  paymentMethod: 'MPESA' | 'CARD';

  @ApiPropertyOptional({ description: 'M-Pesa phone number in international format, e.g. 254712345678' })
  @IsOptional()
  @IsString()
  mpesaPhoneNumber?: string;
}

export class WiseCorporateInvoiceDto {
  @ApiProperty({ description: 'Plan ID to invoice for' })
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ enum: BillingCycle, description: 'Billing cycle: MONTHLY or ANNUAL' })
  @IsEnum(BillingCycle)
  @IsNotEmpty()
  billingCycle: BillingCycle;

  @ApiProperty({ enum: ['USD', 'EUR', 'GBP'], description: 'Settlement currency' })
  @IsEnum(['USD', 'EUR', 'GBP'])
  @IsNotEmpty()
  currency: 'USD' | 'EUR' | 'GBP';

  @ApiPropertyOptional({ description: 'Client Purchase Order Number / Internal Billing Code' })
  @IsOptional()
  @IsString()
  purchaseOrderNumber?: string;
}
