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
  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'TRIAL'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'TRIAL'])
  status?: string;

  @ApiPropertyOptional({ enum: ['STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'] })
  @IsOptional()
  @IsIn(['STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'])
  planTier?: string;
}
