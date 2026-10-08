import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Connection, ConnectionStates } from 'mongoose';

import { Public } from '@common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness — is the process up?' })
  live(): { status: 'ok'; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Public()
  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness — is Mongo reachable?' })
  async ready(): Promise<{ status: 'ready'; database: 'up' }> {
    if (this.connection.readyState !== ConnectionStates.connected) {
      throw new ServiceUnavailableException('Database is not connected.');
    }

    await this.connection.db?.admin().ping();

    return { status: 'ready', database: 'up' };
  }
}
