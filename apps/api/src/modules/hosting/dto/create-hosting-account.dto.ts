import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHostingAccountDto {
  @ApiProperty()
  @IsUUID()
  clientId: string;

  @ApiProperty({ example: 'acaciahealthcare.com' })
  @IsString() @IsNotEmpty() @MaxLength(253)
  domain: string;

  @ApiProperty({ example: 'Oracle Cloud (Frankfurt)' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  server: string;

  @ApiProperty({ enum: ['STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'] })
  @IsIn(['STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'])
  plan: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(45)
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  serverOs?: string;
}
