import { IsString, IsOptional, IsIn, MaxLength, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(150)
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsEmail() @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @MaxLength(255)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @MaxLength(80)
  country?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @MaxLength(40)
  taxPin?: string | null;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'TRIAL'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'CANCELLED', 'TRIAL'])
  status?: string;

  @ApiPropertyOptional({ enum: ['STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'] })
  @IsOptional()
  @IsIn(['STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'])
  planTier?: string;
}
