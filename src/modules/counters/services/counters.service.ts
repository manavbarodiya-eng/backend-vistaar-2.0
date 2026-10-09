import { Injectable } from '@nestjs/common';

import { CounterRepository } from '../repositories/counter.repository';

const AGENT_ID_KEY = 'agent_id';

/** `VST-000001` — the number a partner, a report and the HO desk quote. */
export const formatAgentId = (n: number): string =>
  `VST-${String(n).padStart(6, '0')}`;

@Injectable()
export class CountersService {
  constructor(private readonly counters: CounterRepository) {}

  async nextAgentId(): Promise<string> {
    return formatAgentId(await this.counters.next(AGENT_ID_KEY));
  }
}
