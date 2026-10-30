import { IsString, IsNotEmpty, IsFQDN, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DnsResolveDto {
  @ApiProperty({ example: 'acaciahealthcare.co.ke' })
  @IsString()
  @IsNotEmpty()
  @IsFQDN({ require_tld: true }, { message: 'Domain must be a valid public FQDN' })
  domain: string;
}

export class ImpersonateClientDto {
  @ApiProperty({ description: 'Client UUID to view-as' })
  @IsUUID()
  @IsNotEmpty()
  clientId: string;
}
