import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(150)
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(80)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(40)
  taxPin?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'TRIAL'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'TRIAL'])
  status?: string;

  @ApiPropertyOptional({ enum: ['STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'] })
  @IsOptional()
  @IsIn(['STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'])
  planTier?: string;
}
