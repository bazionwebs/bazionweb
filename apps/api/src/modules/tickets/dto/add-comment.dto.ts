import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCommentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({ description: 'Staff only — hide from client view' })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
