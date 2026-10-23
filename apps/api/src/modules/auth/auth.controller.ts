import {
  Controller, Post, Body, Headers, HttpCode, UseGuards,
  HttpStatus, UnauthorizedException, Logger, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsEmail, IsString, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public, Roles, JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

class LoginDto {
  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

class SetPasswordDto {
  @ApiProperty({ description: 'Target user id (staff only)' })
  @IsUUID()
  userId: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword: string;
}

class ClaimAccountDto {
  @ApiProperty({ example: 'jane@yourcompany.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Single-use claim token from the emailed link' })
  @IsString()
  claimToken: string;

  @ApiProperty({ example: 'SecurePass123!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ required: false, example: 'Jane' })
  @IsString()
  @MaxLength(64)
  firstName?: string;

  @ApiProperty({ required: false, example: 'Wanjiku' })
  @IsString()
  @MaxLength(64)
  lastName?: string;
}

class MagicLinkRequestDto {
  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  email: string;
}

class MagicLinkVerifyDto {
  @ApiProperty({ description: 'Single-use magic token from the emailed link' })
  @IsString()
  token: string;
}

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Exchange email + password for access + refresh tokens via Keycloak
   * POST /api/v1/auth/login
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login — exchange credentials for JWT tokens' })
  async login(@Body() dto: LoginDto) {
    try {
      return await this.authService.login(dto.email, dto.password);
    } catch {
      throw new UnauthorizedException('Invalid email or password');
    }
  }

  /**
   * Revoke tokens via Keycloak logout endpoint
   * POST /api/v1/auth/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout — revoke refresh token' })
  async logout(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '');
    if (token) await this.authService.logout(token);
  }

  /**
   * Exchange refresh token for new access token
   * POST /api/v1/auth/refresh
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh — exchange refresh token for new access token' })
  async refresh(@Body() dto: RefreshDto) {
    try {
      return await this.authService.refresh(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Email a single-use claim link to a paid, not-yet-claimed billing address.
   * POST /api/v1/auth/claim-link
   */
  @Post('claim-link')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a one-time account-claim link' })
  async requestClaimLink(@Body() dto: MagicLinkRequestDto) {
    return this.authService.requestClaimLink(dto.email);
  }

  /**
   * Convert a paid subscription email into a login account.
   * POST /api/v1/auth/claim-account — the "account after payment" step.
   * Requires the emailed claim token (proof of inbox ownership) plus
   * server-side proof of payment; can never activate an unpaid email.
   */
  @Post('claim-account')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Claim an account created by a completed payment' })
  async claimAccount(@Body() dto: ClaimAccountDto) {
    return this.authService.claimAccount(dto);
  }

  /**
   * Mint a single-use magic-link token for an existing user.
   * POST /api/v1/auth/magic-link — returns the raw token for the web layer
   * to email; unknown emails return an identical shape (no enumeration).
   */
  @Post('magic-link')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a one-time sign-in link token' })
  async requestMagicLink(@Body() dto: MagicLinkRequestDto) {
    return this.authService.requestMagicLink(dto.email);
  }

  /**
   * Consume a magic token and return a real session.
   * POST /api/v1/auth/magic-link/verify
   */
  @Post('magic-link/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify a sign-in link token (single use)' })
  async verifyMagicLink(@Body() dto: MagicLinkVerifyDto) {
    return this.authService.verifyMagicLink(dto.token);
  }

  /**
   * Set (or rotate) a user's local password. Staff-only provisioning path —
   * this is how client/staff accounts created without credentials get theirs.
   * POST /api/v1/auth/admin/set-password
   */
  @Post('admin/set-password')
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin — set a user local password' })
  async setPassword(@Body() dto: SetPasswordDto) {
    const user = await this.authService.setUserPassword(dto.userId, dto.newPassword);
    if (!user) throw new NotFoundException('User not found');
    return { data: { userId: user.id } };
  }
}
