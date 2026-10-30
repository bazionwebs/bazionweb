import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  IsIn,
  IsEmail,
  IsInt,
  Max,
  Min,
  IsISO8601,
  MaxLength,
} from 'class-validator';

export class CalculateQuoteDto {
  @IsOptional()
  @IsString()
  marketCode?: string; // 'KE', 'GLOBAL', etc.

  @IsOptional()
  @IsString()
  countryCode?: string; // e.g. 'KE', 'US', 'GB'

  @IsString()
  @IsIn(['launch', 'business', 'professional', 'ecom-starter', 'ecom-business', 'custom', 'starter', 'ecommerce', 'enterprise'])
  packageType: 'launch' | 'business' | 'professional' | 'ecom-starter' | 'ecom-business' | 'custom' | 'starter' | 'ecommerce' | 'enterprise';

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(0)
  @Max(100)
  extraPages?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  selectedAddOns?: string[];

  @IsOptional()
  @IsBoolean()
  rushDelivery?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['none', 'care-essential', 'care-business', 'care-professional', 'starter', 'growth', 'scale'])
  care?: 'none' | 'care-essential' | 'care-business' | 'care-professional' | 'starter' | 'growth' | 'scale';

  @IsOptional()
  @IsString()
  @IsIn(['none', 'host-essential', 'host-business', 'host-pro', 'starter', 'business', 'enterprise'])
  hosting?: 'none' | 'host-essential' | 'host-business' | 'host-pro' | 'starter' | 'business' | 'enterprise';

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  clientEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientCompany?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  sourceCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  service?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;
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
  @Max(1)
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
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minSpend?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
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
