import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

import type { PartnerPrincipal } from '@common/interfaces/principal.interface';
import type { Env } from '@config/env.schema';

const ISSUER = 'vistaar-api';
const AUDIENCE = 'vistaar-app';

interface PartnerClaims {
  sub: string;
  agent_id: string;
  pii_id: string;
  typ: 'access';
}

/**
 * Signs and verifies the partner access token.
 *
 * HS256 with a key no other service holds, and the algorithm, issuer and
 * audience are pinned on verify — so a `none` token, an RS/HS swap, or a token
 * minted for another app is refused before any claim is read.
 */
@Injectable()
export class PartnerTokenService {
  private readonly secret: string;
  readonly ttlSeconds: number;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get('VISTAAR_JWT_SECRET', { infer: true });
    this.ttlSeconds = config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true });
  }

  sign(principal: Omit<PartnerPrincipal, 'kind'>): string {
    const claims: PartnerClaims = {
      sub: principal.sub,
      agent_id: principal.agent_id,
      pii_id: principal.pii_id,
      typ: 'access',
    };
    return jwt.sign(claims, this.secret, {
      algorithm: 'HS256',
      expiresIn: this.ttlSeconds,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  }

  /** `null` for anything that is not a valid, unexpired partner token. */
  verify(token: string): PartnerPrincipal | null {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (typeof decoded !== 'object') return null;

      const { sub, agent_id, pii_id, typ } = decoded as Partial<PartnerClaims>;
      if (
        typ !== 'access' ||
        typeof sub !== 'string' ||
        typeof agent_id !== 'string' ||
        typeof pii_id !== 'string'
      ) {
        return null;
      }
      return { kind: 'partner', sub, agent_id, pii_id };
    } catch {
      return null;
    }
  }
}
