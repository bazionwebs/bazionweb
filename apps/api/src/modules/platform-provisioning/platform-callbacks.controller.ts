import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/guards/jwt-auth.guard';
import { PlatformCallbackProjectionService } from './platform-callback-projection.service';

@ApiTags('webhooks')
@Controller({ path: 'webhooks/platform', version: '1' })
export class PlatformCallbacksController {
  constructor(private readonly projection: PlatformCallbackProjectionService) {}

  @Post('provisioning-status')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receive signed Bazion Platform provisioning status callback' })
  async receiveProvisioningStatus(
    @Req() req: Request,
    @Headers('x-bazion-signature') signature?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const raw = (req as any).rawBody as Buffer | undefined;
    const rawBody =
      raw ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    const parsedBody =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : (req.body ?? (raw ? JSON.parse(raw.toString('utf8')) : {}));

    return this.projection.ingestSignedStatusCallback({
      rawBody,
      body: parsedBody,
      signatureHeader: signature,
      authorizationHeader: authorization,
    });
  }

  @Post('lifecycle-status')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receive signed Bazion Platform subscription lifecycle status callback' })
  async receiveLifecycleStatus(
    @Req() req: Request,
    @Headers('x-bazion-signature') signature?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const raw = (req as any).rawBody as Buffer | undefined;
    const rawBody =
      raw ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    const parsedBody =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : (req.body ?? (raw ? JSON.parse(raw.toString('utf8')) : {}));

    return this.projection.ingestSignedLifecycleCallback({
      rawBody,
      body: parsedBody,
      signatureHeader: signature,
      authorizationHeader: authorization,
    });
  }
}

