// submit-quote.dto.ts
import { IsEmail, IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitQuoteDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  company?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['starter', 'growth', 'business', 'enterprise', 'unsure'])
  plan?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(50)
  service?: string;

  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(3000)
  message: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  urgent?: boolean;
}
