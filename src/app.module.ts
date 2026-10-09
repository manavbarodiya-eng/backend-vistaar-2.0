import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from '@core/filters/all-exceptions.filter';
import { PartnerHeaderGuard } from '@core/guards/partner-header.guard';
import { EnvelopeInterceptor } from '@core/interceptors/envelope.interceptor';
import { THROTTLE_OPTIONS } from '@core/throttle/throttle.config';
import { validateEnv, type Env } from '@config/env.schema';
import { DatabaseModule } from '@database/database.module';
import { CartModule } from '@modules/cart/cart.module';
import { HealthModule } from '@modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          // Tokens and OTPs never reach a log line.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.otp',
              'req.body.refresh_token',
            ],
            remove: true,
          },
        },
      }),
    }),

    ThrottlerModule.forRoot(THROTTLE_OPTIONS),

    DatabaseModule,

    // ── Feature modules ──────────────────────────────────────────────
    // One folder per module under src/modules/, each with the four layers:
    //   controller → service → repository → schema
    HealthModule,
    CartModule,
  ],
  providers: [
    // The auth guard is registered here, ahead of the throttler, with the
    // login module: the throttler keys on the verified `request.user`, which
    // only exists once that guard has run. Until then `PartnerHeaderGuard`
    // stands in (off unless TRUST_PARTNER_HEADER=true) — remove it with login.
    { provide: APP_GUARD, useClass: PartnerHeaderGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
