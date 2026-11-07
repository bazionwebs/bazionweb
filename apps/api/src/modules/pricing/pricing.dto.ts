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

const ALLOWED_QUOTE_PACKAGE_TYPES = [
  'existing',
  'existing-website',
  'byow',
  'website-existing',
  'launch',
  'business',
  'professional',
  'ecom-starter',
  'ecom-business',
  'ecom-pro',
  'custom',
  'corporate',
  'starter',
  'ecommerce',
  'enterprise',
  'website-launch',
  'website-business',
  'website-professional',
  'website-enterprise',
  'ecommerce-starter',
  'ecommerce-business',
  'ecommerce-enterprise',
  'service-admin-hub-starter',
  'service-admin-hub-pro',
  'service-admin-hub-corporate',
  'custom-tier-1',
  'custom-tier-2',
  'custom-tier-3',
  'pkg-launch',
  'pkg-business',
  'pkg-professional',
  'pkg-ecommerce',
  'pkg-ecommerce-business',
  'pkg-custom-app',
] as const;

const ALLOWED_QUOTE_HOSTING_OPTIONS = [
  'none',
  'host-essential',
  'host-business',
  'host-pro',
  'host-professional',
  'host-cloud',
  'starter',
  'business',
  'enterprise',
  'host-essential-monthly',
  'host-essential-quarterly',
  'host-essential-semiannual',
  'host-essential-annual',
  'host-essential-biennial',
  'host-essential-triennial',
  'host-business-monthly',
  'host-business-quarterly',
  'host-business-semiannual',
  'host-business-annual',
  'host-business-biennial',
  'host-business-triennial',
  'host-pro-monthly',
  'host-pro-quarterly',
  'host-pro-semiannual',
  'host-pro-annual',
  'host-pro-biennial',
  'host-pro-triennial',
  'host-professional-monthly',
  'host-professional-quarterly',
  'host-professional-semiannual',
  'host-professional-annual',
  'host-professional-biennial',
  'host-professional-triennial',
  'host-cloud-monthly',
  'host-cloud-quarterly',
  'host-cloud-semiannual',
  'host-cloud-annual',
  'host-cloud-biennial',
  'host-cloud-triennial',
] as const;

export class CalculateQuoteDto {
  @IsOptional()
  @IsString()
  marketCode?: string; // 'KE', 'GLOBAL', etc.

  @IsOptional()
  @IsString()
  countryCode?: string; // e.g. 'KE', 'US', 'GB'

  @IsString()
  @IsIn(ALLOWED_QUOTE_PACKAGE_TYPES)
  packageType: (typeof ALLOWED_QUOTE_PACKAGE_TYPES)[number];

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
  @IsIn([
    'none',
    'care-essential',
    'care-business',
    'care-professional',
    'care-enterprise',
    'starter',
    'growth',
    'scale',
  ])
  care?:
    | 'none'
    | 'care-essential'
    | 'care-business'
    | 'care-professional'
    | 'care-enterprise'
    | 'starter'
    | 'growth'
    | 'scale';

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_QUOTE_HOSTING_OPTIONS)
  hosting?: (typeof ALLOWED_QUOTE_HOSTING_OPTIONS)[number];

  @IsOptional()
  @IsString()
  @IsIn([
    'monthly',
    'quarterly',
    'semi-annually',
    'annually',
    'biennially',
    'triennially',
    'MONTHLY',
    'QUARTERLY',
    'SEMI_ANNUALLY',
    'ANNUAL',
    'BIENNIAL',
    'TRIENNIAL',
  ])
  billingCycle?: string;

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
