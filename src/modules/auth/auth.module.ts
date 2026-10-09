import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AgentsModule } from '@modules/agents/agents.module';
import { SpineModule } from '@modules/spine/spine.module';

import { AuthController } from './controllers/auth.controller';
import { SessionRepository } from './repositories/session.repository';
import { Session, SessionSchema } from './schemas/session.schema';
import { AuthService } from './services/auth.service';
import { OtpService } from './services/otp.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    AgentsModule,
    SpineModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, SessionRepository],
})
export class AuthModule {}
