// create-ticket.dto.ts
import { IsString, IsNotEmpty, IsEnum, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TicketPriority, TicketCategory } from '@prisma/client';

export class CreateTicketDto {
  @ApiProperty({ example: 'Contact form not sending emails' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(255)
  subject: string;

  @ApiProperty({ enum: TicketPriority, example: 'P3' })
  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @ApiProperty({ enum: TicketCategory, example: 'HOSTING' })
  @IsEnum(TicketCategory)
  category: TicketCategory;

  @ApiProperty({ example: 'When I click submit on the contact form...' })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(5000)
  body: string;
}
