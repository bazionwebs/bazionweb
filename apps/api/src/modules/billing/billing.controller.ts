import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request, 
  ParseUUIDPipe 
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard, Roles } from '../../common/guards/jwt-auth.guard';
import { MfaGuard } from '../../common/guards/mfa.guard';
import { IntaSendSubscriptionDto, WiseCorporateInvoiceDto } from './dto/billing.dto';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MfaGuard)
@Controller({ path: 'invoices', version: '1' })
export class BillingController {
  constructor(private readonly svc: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices (scoped by role)' })
  findAll(
    @Request() req: any,
    @Query('scope') scope?: string,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.findAll(req.user, { scope, status, page: +page, limit: +limit });
  }

  @Post('subscribe/intasend')
  @ApiOperation({ summary: 'Initialize IntaSend M-Pesa STK Push or Card Checkout' })
  subscribeIntaSend(@Request() req: any, @Body() body: IntaSendSubscriptionDto) {
    return this.svc.subscribeIntaSend(req.user, body);
  }

  @Post('corporate-invoice/wise')
  @ApiOperation({ summary: 'Generate B2B Corporate Invoice with Wise Virtual Bank Details' })
  createWiseCorporateInvoice(@Request() req: any, @Body() body: WiseCorporateInvoiceDto) {
    return this.svc.createWiseCorporateInvoice(req.user, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.svc.findOne(id, req.user);
  }

  @Post('generate')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Manually generate invoice (admin)' })
  generate(@Body() body: { clientId: string; subscriptionId?: string; amount: number; notes?: string }) {
    return this.svc.generate(body);
  }

  @Patch(':id/mark-paid')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Mark invoice as paid (admin)' })
  markPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markPaid(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Get PDF download URL for invoice' })
  getPdf(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.svc.getPdfUrl(id, req.user);
  }
}
