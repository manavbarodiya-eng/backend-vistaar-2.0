import { Global, Module } from '@nestjs/common';

import { AppAuthGuard } from './app-auth.guard';
import { PartnerTokenService } from './partner-token.service';
import { SsoTokenVerifier } from './sso-token.verifier';

/**
 * Token machinery only: verification for both kinds, and signing for the
 * partner one. Global so the login module can sign without importing core
 * wiring. The login routes themselves live in `modules/auth/`.
 */
@Global()
@Module({
  providers: [PartnerTokenService, SsoTokenVerifier, AppAuthGuard],
  exports: [PartnerTokenService, SsoTokenVerifier, AppAuthGuard],
})
export class AuthCoreModule {}
