import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const VAULT_CATEGORIES = [
  'DOMAIN_REGISTRAR',
  'HOSTING_SSH',
  'API_KEY',
  'PAYMENT_GATEWAY',
  'DATABASE',
  'CMS_ADMIN',
  'OTHER',
] as const;

export type VaultCategoryLiteral = (typeof VAULT_CATEGORIES)[number];

export class CreateVaultSecretDto {
  @ApiProperty({ example: 'Safaricom Daraja Production Consumer Secret' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label: string;

  @ApiPropertyOptional({ enum: VAULT_CATEGORIES, default: 'OTHER' })
  @IsOptional()
  @IsIn(VAULT_CATEGORIES)
  category?: VaultCategoryLiteral;

  @ApiPropertyOptional({ example: 'admin@yourdomain.co.ke' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  username?: string;

  @ApiPropertyOptional({ example: 'https://developer.safaricom.co.ke' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  serviceUrl?: string;

  @ApiProperty({ description: 'Plaintext secret value — encrypted at rest with AES-256-GCM' })
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  value: string;

  @ApiPropertyOptional({ example: 'Production shortcode 4123456 credentials' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

