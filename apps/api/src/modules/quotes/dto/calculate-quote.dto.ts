import { IsArray, IsBoolean, IsIn, IsOptional, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PageSpec {
  @IsString()
  @IsIn(['simple', 'standard', 'complex'])
  type: 'simple' | 'standard' | 'complex';
}

export class CalculateQuoteDto {
  @ApiProperty({ type: [PageSpec], description: 'Array of page specs to build' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageSpec)
  pages: PageSpec[];

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  hasCms?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  hasEcommerce?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  needsMigration?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  customDesign?: boolean;

  @ApiProperty({ enum: ['starter', 'growth', 'business', 'enterprise'] })
  @IsIn(['starter', 'growth', 'business', 'enterprise'])
  tier: string;
}
