import {
  IsString,
  IsNotEmpty,
  IsFQDN,
  IsUUID,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class RemediateOrphanPaymentDto {
  @ApiProperty({ description: 'PaymentLog ID' })
  @IsUUID()
  @IsNotEmpty()
  paymentLogId: string;

  @ApiPropertyOptional({ description: 'Target Invoice ID to link and settle' })
  @IsUUID()
  @IsOptional()
  targetInvoiceId?: string;

  @ApiPropertyOptional({ description: 'Target Client ID to credit' })
  @IsUUID()
  @IsOptional()
  targetClientId?: string;

  @ApiProperty({ enum: ['LINK_AND_SETTLE', 'CREDIT_CLIENT'] })
  @IsEnum(['LINK_AND_SETTLE', 'CREDIT_CLIENT'])
  action: 'LINK_AND_SETTLE' | 'CREDIT_CLIENT';
}

export class RemediateDnsSslDto {
  @ApiProperty({ description: 'Domain name' })
  @IsString()
  @IsNotEmpty()
  domain: string;

  @ApiPropertyOptional({ description: 'HostingAccount ID' })
  @IsUUID()
  @IsOptional()
  hostingAccountId?: string;

  @ApiProperty({ enum: ['REFRESH_SSL', 'REISSUE_SSL'] })
  @IsEnum(['REFRESH_SSL', 'REISSUE_SSL'])
  action: 'REFRESH_SSL' | 'REISSUE_SSL';
}

export class RetryWebhooksBatchDto {
  @ApiPropertyOptional({ description: 'Hours to look back (default 24)' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  windowHours?: number;
}

export class RemediateInvoiceSyncDto {
  @ApiProperty({ description: 'Invoice ID' })
  @IsUUID()
  @IsNotEmpty()
  invoiceId: string;

  @ApiProperty({
    enum: ['SYNC_FROM_PAYMENTS', 'RECALCULATE_FROM_ITEMS', 'MARK_PAID', 'MARK_OVERDUE'],
  })
  @IsEnum(['SYNC_FROM_PAYMENTS', 'RECALCULATE_FROM_ITEMS', 'MARK_PAID', 'MARK_OVERDUE'])
  action: 'SYNC_FROM_PAYMENTS' | 'RECALCULATE_FROM_ITEMS' | 'MARK_PAID' | 'MARK_OVERDUE';
}

export class RemediateClientAccessDto {
  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ enum: ['UNLOCK_ACCOUNT', 'GENERATE_RESET_LINK', 'RESTORE_USER'] })
  @IsEnum(['UNLOCK_ACCOUNT', 'GENERATE_RESET_LINK', 'RESTORE_USER'])
  action: 'UNLOCK_ACCOUNT' | 'GENERATE_RESET_LINK' | 'RESTORE_USER';
}

export class RemediateDomainStateDto {
  @ApiProperty({ description: 'HostingAccount ID' })
  @IsUUID()
  @IsNotEmpty()
  hostingAccountId: string;

  @ApiProperty({ enum: ['UNSUSPEND', 'NORMALIZE_STATUS'] })
  @IsEnum(['UNSUSPEND', 'NORMALIZE_STATUS'])
  action: 'UNSUSPEND' | 'NORMALIZE_STATUS';
}

export class RemediateProactiveAnomalyDto {
  @ApiPropertyOptional({ description: 'Unique anomaly identifier' })
  @IsString()
  @IsOptional()
  anomalyId?: string;

  @ApiPropertyOptional({ description: 'Rule key (e.g. SSL_EXPIRING_7D, WEBHOOK_BURST, UNAPPLIED_PAYMENT, EXPIRED_QUOTE_DEPOSIT)' })
  @IsString()
  @IsOptional()
  rule?: string;

  @ApiProperty({ description: 'Remediation action keyword' })
  @IsString()
  @IsNotEmpty()
  remediationAction: string;

  @ApiPropertyOptional({ description: 'Context payload required for remediation' })
  @IsOptional()
  remediationPayload?: Record<string, any>;
}

