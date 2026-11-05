import { IsEmail, IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ManualProvisionClientDto {
  @ApiProperty({ example: 'Acacia Global Logistics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  businessName: string;

  @ApiProperty({ example: 'David Kimani' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contactName: string;

  @ApiProperty({ example: 'david@acaciaglobal.co.ke' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+254712345678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: 'Plan ID to assign' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ example: 'GROWTH' })
  @IsOptional()
  @IsString()
  planTier?: string;

  @ApiPropertyOptional({ example: 'KE' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  marketCode?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ example: 'Acacia Freight Platform Migration' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  projectTitle?: string;

  @ApiPropertyOptional({ example: 'Kenya' })
  @IsOptional()
  @IsString()
  country?: string;
}
