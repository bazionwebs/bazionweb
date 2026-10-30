import { IsString, IsNotEmpty, IsOptional, IsEnum, IsFQDN, IsIP, IsInt, Min, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HostingStatus } from '@prisma/client';

export class CreateHostingAccountDto {
  @ApiProperty()
  @IsUUID()
  clientId: string;

  @ApiProperty({ example: 'acaciahealthcare.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  @IsFQDN({ require_tld: true }, { message: 'domain must be a valid public fully-qualified domain name' })
  domain: string;

  @ApiProperty({ example: 'Oracle Cloud (Frankfurt)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  server: string;

  @ApiProperty({ example: 'STARTER' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  plan: string;

  @ApiPropertyOptional()
  @IsOptional() @IsIP() @MaxLength(45)
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  serverOs?: string;
}

export class UpdateHostingAccountDto {
  @ApiPropertyOptional({ example: 'Oracle Cloud (Frankfurt)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  server?: string;

  @ApiPropertyOptional({ example: 'STARTER' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  plan?: string;

  @ApiPropertyOptional({ enum: HostingStatus })
  @IsOptional()
  @IsEnum(HostingStatus)
  status?: HostingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIP()
  @MaxLength(45)
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serverOs?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phpVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  diskUsageMb?: number;
}
