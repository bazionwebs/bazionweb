import { IsString, IsNotEmpty, IsOptional, IsEnum, IsFQDN, IsIP, IsInt, Min, MaxLength, IsUUID, Matches, MinLength } from 'class-validator';
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

export class MapPlatformHostingDeploymentDto {
  @ApiProperty({ description: 'Opaque UUID returned by Bazion Platform; never a provider resource ID.' })
  @IsUUID()
  platformDeploymentId: string;

  @ApiProperty({ description: 'Auditable change ticket or migration evidence reference; no secrets or customer data.' })
  @IsString()
  @MinLength(7)
  @MaxLength(300)
  @Matches(/^(?:CHG|INC|MIG|ROLLBACK|DRILL|TICKET)[-:/#][A-Za-z0-9][A-Za-z0-9._:/#-]{2,292}$/i)
  evidenceRef: string;
}

export class UnmapPlatformHostingDeploymentDto {
  @ApiProperty({ description: 'Auditable rollback change ticket or drill reference; no secrets or customer data.' })
  @IsString()
  @MinLength(7)
  @MaxLength(300)
  @Matches(/^(?:CHG|INC|MIG|ROLLBACK|DRILL|TICKET)[-:/#][A-Za-z0-9][A-Za-z0-9._:/#-]{2,292}$/i)
  evidenceRef: string;
}
