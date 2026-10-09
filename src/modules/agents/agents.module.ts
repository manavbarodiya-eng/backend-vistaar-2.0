import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CountersModule } from '@modules/counters/counters.module';
import { SettingsModule } from '@modules/settings/settings.module';

import { AgentRepository } from './repositories/agent.repository';
import { Agent, AgentSchema } from './schemas/agent.schema';
import { AgentsService } from './services/agents.service';

/** Owns `vistaar_v2_agents`. Its routes live in auth (login), onboarding (`/me`) and the desk. */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Agent.name, schema: AgentSchema }]),
    CountersModule,
    SettingsModule,
  ],
  providers: [AgentRepository, AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
