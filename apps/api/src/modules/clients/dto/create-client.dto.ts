// create-client.dto.ts
import { IsEmail, IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(150)
  businessName: string;

  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(100)
  contactName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiProperty({ enum: ['STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'] })
  @IsIn(['STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'])
  planTier: string;

  @ApiPropertyOptional({ default: 'KE' })
  @IsOptional() @IsString()
  country?: string;
}
