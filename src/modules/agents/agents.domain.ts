/**
 * The partner pipeline — the stages the HO portal's tabs are built from.
 *
 *   signed_up → onboarding → kyc_review → approved
 *                   ↑            │  └──→ rejected ──(reopen)──→ onboarding
 *                   │            ↓
 *                   └── changes_requested (partner fixes the flagged fields)
 *
 * `blocked` can be entered from any stage and returns to the one it left.
 */
/**
 * `userroles` id every partner carries. Partners live here, not in
 * `agents_v2`; their head is Offline Head (USR-1037, see `access.domain`).
 */
export const PARTNER_ROLE_CODE = 'USR-1040';

export const STAGES = [
  'signed_up',
  'onboarding',
  'kyc_review',
  'changes_requested',
  'approved',
  'rejected',
  'blocked',
] as const;

export type Stage = (typeof STAGES)[number];

/** Stages in which the partner may still write their onboarding data. */
export const PARTNER_EDITABLE: ReadonlySet<Stage> = new Set([
  'signed_up',
  'onboarding',
  'changes_requested',
]);

export type StageAction =
  | 'start_onboarding'
  | 'submit'
  | 'request_changes'
  | 'approve'
  | 'reject'
  | 'reopen'
  | 'block';

/** Where each action may start from, and where it lands. */
export const TRANSITIONS: Record<
  StageAction,
  { from: readonly Stage[]; to: Stage }
> = {
  start_onboarding: { from: ['signed_up'], to: 'onboarding' },
  submit: { from: ['onboarding', 'changes_requested'], to: 'kyc_review' },
  request_changes: { from: ['kyc_review'], to: 'changes_requested' },
  approve: { from: ['kyc_review'], to: 'approved' },
  reject: { from: ['kyc_review', 'changes_requested'], to: 'rejected' },
  reopen: { from: ['rejected'], to: 'onboarding' },
  block: {
    from: [
      'signed_up',
      'onboarding',
      'kyc_review',
      'changes_requested',
      'approved',
      'rejected',
    ],
    to: 'blocked',
  },
};

export const canMove = (action: StageAction, stage: Stage): boolean =>
  TRANSITIONS[action].from.includes(stage);
