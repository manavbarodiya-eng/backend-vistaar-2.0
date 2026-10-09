/**
 * Who is calling, as the global auth guard verified it. Two kinds, never
 * interchangeable: a partner token cannot reach `/admin/*` and an SSO token
 * cannot reach a partner route.
 */
export interface PartnerPrincipal {
  kind: 'partner';
  /** `vistaar_v2_agents._id` — the one key every partner write is filed under. */
  sub: string;
  agent_id: string;
  pii_id: string;
}

export interface AdminPrincipal {
  kind: 'admin';
  /** The SSO token's email — the key into `agents_v2`. */
  email: string;
  /** Issued-at and expiry of the SSO token, for the per-token access cache. */
  iat: number;
  exp: number;
  /** Present when the SSO token carries a role claim (ko-sales-style tokens). */
  user_role?: string;
}

export type Principal = PartnerPrincipal | AdminPrincipal;

/** What the guard leaves on the request. */
export interface AuthedRequest {
  user?: Principal;
}
