import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentPartner } from '@common/decorators/current-principal.decorator';
import { Public } from '@common/decorators/public.decorator';
import type { PartnerPrincipal } from '@common/interfaces/principal.interface';

import {
  OtpRequestDto,
  OtpSentDto,
  OtpVerifyDto,
  RefreshDto,
  SessionDto,
} from '../dto/auth.dto';
import { AuthService } from '../services/auth.service';

/** Per IP on the public routes; the OTP service adds a per-number limit on top. */
const PUBLIC_LIMIT = { default: { limit: 20, ttl: 60_000 } };

@ApiTags('app · auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(PUBLIC_LIMIT)
  @Post('otp/send')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Send an OTP. Creates the partner record (otp_verified=false) on first use.',
  })
  @ApiOkResponse({ type: OtpSentDto })
  send(@Body() dto: OtpRequestDto): Promise<OtpSentDto> {
    return this.auth.sendOtp(dto.phone, dto.country_code, false);
  }

  @Public()
  @Throttle(PUBLIC_LIMIT)
  @Post('otp/resend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend the OTP (same limits as send)' })
  @ApiOkResponse({ type: OtpSentDto })
  resend(@Body() dto: OtpRequestDto): Promise<OtpSentDto> {
    return this.auth.sendOtp(dto.phone, dto.country_code, true);
  }

  @Public()
  @Throttle(PUBLIC_LIMIT)
  @Post('otp/verify')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Verify the OTP → session. First verify gives the VST id and links the PII.',
  })
  @ApiOkResponse({ type: SessionDto })
  verify(
    @Body() dto: OtpVerifyDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<SessionDto> {
    return this.auth.verifyOtp(
      dto.phone,
      dto.country_code,
      dto.otp,
      userAgent ?? null,
    );
  }

  @Public()
  @Throttle(PUBLIC_LIMIT)
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'New token pair. The refresh token sent is spent.' })
  @ApiOkResponse({ type: SessionDto })
  refresh(
    @Body() dto: RefreshDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<SessionDto> {
    return this.auth.refresh(dto.refresh_token, userAgent ?? null);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign this device out (deletes its refresh token)' })
  logout(
    @CurrentPartner() partner: PartnerPrincipal,
    @Body() dto: RefreshDto,
  ): Promise<{ signed_out: true }> {
    return this.auth.logout(partner.sub, dto.refresh_token);
  }
}
