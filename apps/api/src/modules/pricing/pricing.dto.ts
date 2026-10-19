import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsIn,
  Min,
  IsISO8601,
} from 'class-validator';

export class CalculateQuoteDto {
  @IsOptional()
  @IsString()
  marketCode?: string; // 'KE', 'GLOBAL', etc.

  @IsOptional()
  @IsString()
  countryCode?: string; // e.g. 'KE', 'US', 'GB'

  @IsString()
  @IsIn(['starter', 'business', 'ecommerce', 'enterprise'])
  packageType: 'starter' | 'business' | 'ecommerce' | 'enterprise';

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraPages?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedAddOns?: string[];

  @IsOptional()
  @IsBoolean()
  rushDelivery?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['none', 'starter', 'growth', 'scale'])
  care?: 'none' | 'starter' | 'growth' | 'scale';

  @IsOptional()
  @IsString()
  @IsIn(['none', 'starter', 'business', 'enterprise'])
  hosting?: 'none' | 'starter' | 'business' | 'enterprise';

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  clientName?: string;
}

export class UpsertPriceDto {
  @IsString()
  priceBookId: string;

  @IsString()
  productId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  billingPeriod?: string;

  @IsOptional()
  @IsString()
  changeReason?: string;
}

export class CreatePriceBookDto {
  @IsString()
  id: string; // e.g. 'KE-2027-v1'

  @IsString()
  marketId: string;

  @IsString()
  name: string;

  @IsString()
  version: string;

  @IsISO8601()
  effectiveFrom: string;

  @IsOptional()
  @IsISO8601()
  effectiveUntil?: string;

  @IsOptional()
  @IsString()
  changeReason?: string;
}

export class UpsertTaxRuleDto {
  @IsString()
  marketId: string;

  @IsString()
  name: string;

  @IsString()
  taxType: string;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsBoolean()
  isInclusive: boolean;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  changeReason?: string;
}

export class UpsertAdjustmentDto {
  @IsString()
  marketId: string;

  @IsString()
  name: string;

  @IsString()
  @IsIn(['PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'SURCHARGE'])
  adjustmentType: 'PERCENTAGE_DISCOUNT' | 'FIXED_DISCOUNT' | 'SURCHARGE';

  @IsNumber()
  value: number;

  @IsOptional()
  @IsNumber()
  minSpend?: number;

  @IsOptional()
  @IsNumber()
  maxDiscount?: number;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  changeReason?: string;
}
