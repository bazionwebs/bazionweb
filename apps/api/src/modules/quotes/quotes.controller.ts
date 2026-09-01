// quotes.controller.ts
import { Controller, Post, Body, Version } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { SubmitQuoteDto } from './dto/submit-quote.dto';
import { CalculateQuoteDto } from './dto/calculate-quote.dto';
import { Public } from '../../common/guards/jwt-auth.guard';

@ApiTags('quotes')
@Controller({ path: 'quotes', version: '1' })
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post('submit')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Submit a quote / lead capture form' })
  submit(@Body() dto: SubmitQuoteDto) {
    return this.quotesService.submit(dto);
  }

  @Post('calculate')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Instant quote calculator (FR-01)' })
  calculate(@Body() dto: CalculateQuoteDto) {
    return this.quotesService.calculate(dto);
  }
}
