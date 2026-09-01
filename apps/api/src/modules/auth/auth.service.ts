import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Exchange username/password for Keycloak tokens (Resource Owner Password Credentials flow).
   * Used for first-party login via the portal — not for third-party OAuth.
   */
  async login(email: string, password: string): Promise<{
    data: { accessToken: string; refreshToken: string; expiresIn: number };
  }> {
    const url = `${this.config.get('KEYCLOAK_URL')}/realms/${this.config.get('KEYCLOAK_REALM')}/protocol/openid-connect/token`;

    const params = new URLSearchParams({
      grant_type:    'password',
      client_id:     this.config.get('KEYCLOAK_CLIENT_ID') ?? '',
      client_secret: this.config.get('KEYCLOAK_CLIENT_SECRET') ?? '',
      username:      email,
      password:      password,
      scope:         'openid profile email',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.warn(`Keycloak login failed for ${email}: ${error}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens: KeycloakTokenResponse = await response.json();

    return {
      data: {
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn:    tokens.expires_in,
      },
    };
  }

  /**
   * Revoke a refresh token via Keycloak logout endpoint.
   */
  async logout(accessToken: string): Promise<void> {
    try {
      const url = `${this.config.get('KEYCLOAK_URL')}/realms/${this.config.get('KEYCLOAK_REALM')}/protocol/openid-connect/logout`;

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: new URLSearchParams({
          client_id:     this.config.get('KEYCLOAK_CLIENT_ID') ?? '',
          client_secret: this.config.get('KEYCLOAK_CLIENT_SECRET') ?? '',
        }).toString(),
      });
    } catch (err) {
      this.logger.warn(`Logout token revocation failed: ${err}`);
      // Don't throw — logout should succeed even if revocation fails
    }
  }

  /**
   * Exchange a refresh token for a new access token.
   */
  async refresh(refreshToken: string): Promise<{
    data: { accessToken: string; refreshToken: string; expiresIn: number };
  }> {
    const url = `${this.config.get('KEYCLOAK_URL')}/realms/${this.config.get('KEYCLOAK_REALM')}/protocol/openid-connect/token`;

    const params = new URLSearchParams({
      grant_type:     'refresh_token',
      client_id:      this.config.get('KEYCLOAK_CLIENT_ID') ?? '',
      client_secret:  this.config.get('KEYCLOAK_CLIENT_SECRET') ?? '',
      refresh_token:  refreshToken,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokens: KeycloakTokenResponse = await response.json();

    return {
      data: {
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn:    tokens.expires_in,
      },
    };
  }
}
