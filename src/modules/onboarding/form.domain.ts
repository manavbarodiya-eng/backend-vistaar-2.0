/**
 * The dynamic onboarding form: what HO can configure, how a partner's
 * `raw_data` is checked against it, and how it maps onto the partner record.
 * Pure functions — no DB, no HTTP — so every rule here is unit-tested.
 */
import { isIndiaFix, toPoint, type GeoPoint } from '@common/utils/geo.util';

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'phone',
  'email',
  'pincode',
  'select',
  'multi_select',
  /** One uploaded file: `{ path }`. */
  'file',
  /** A KYC document HO verifies: `{ files: [path, …], number? }`. */
  'document',
  /** Device GPS: `{ lat, lng, accuracy?, captured_at? }`. */
  'location',
  /** A group of sub-fields: `{ key: value }`. */
  'object',
  /** A repeatable group: `[{ key: value }, …]`. */
  'object_list',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** Types allowed inside `object` / `object_list` — one level, no KYC docs. */
const NESTED_TYPES: ReadonlySet<FieldType> = new Set([
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'phone',
  'email',
  'pincode',
  'select',
  'multi_select',
  'file',
]);

/**
 * Where an approved value lands on the partner record. A closed list, so a
 * config can never write an arbitrary field of `vistaar_v2_agents`.
 * `details.<key>` collects anything else HO wants on the profile.
 */
export const MAPS_TO = [
  'name',
  'email',
  'sub_cohort',
  'address_line',
  'village',
  'district',
  'state',
  'pincode',
  'location',
] as const;
export type MapsTo = (typeof MAPS_TO)[number] | `details.${string}`;

/** `{ en: '…', hi: '…' }` — `en` is required, other languages optional. */
export type Localized = Record<string, string>;

export interface Option {
  value: string;
  label: Localized;
}

export interface Validation {
  min?: number;
  max?: number;
  min_length?: number;
  max_length?: number;
  /** A regex the text (or a document's `number`) must match, e.g. PAN. */
  regex?: string;
  /** multi_select / object_list / document files. */
  max_items?: number;
  /** document: the number (PAN, Aadhaar…) is required. */
  number_required?: boolean;
  /** boolean: only `true` counts — an agreement or a declaration. */
  must_accept?: boolean;
}

export interface VisibleIf {
  field: string;
  op: 'eq' | 'ne' | 'in' | 'filled';
  value?: unknown;
}

export interface FieldDef {
  key: string;
  type: FieldType;
  label: Localized;
  placeholder?: Localized;
  help?: Localized;
  required: boolean;
  options?: Option[];
  validation?: Validation;
  visible_if?: VisibleIf;
  maps_to?: MapsTo;
  /**
   * `piis.documents` key (ko-sales spelling: `adhar`, `pan`, `bank_details`,
   * `selfie`…) a `document` field is mirrored to once HO verifies it.
   */
  org_document?: string;
  /** Sub-fields of an `object` / `object_list`. */
  fields?: FieldDef[];
}

export interface StepDef {
  step_id: string;
  order: number;
  title: Localized;
  description?: Localized;
  icon?: string;
  is_active: boolean;
  fields: FieldDef[];
}

export type RawData = Record<string, unknown>;

const KEY = /^[a-z][a-z0-9_]{0,59}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── Config checks (HO publishing a form) ───────────────────────────────────

/** Every problem with a set of steps, as sentences; empty means publishable. */
export function configErrors(steps: StepDef[]): string[] {
  const errors: string[] = [];
  const keys = new Map<string, FieldDef>();
  const mapped = new Set<string>();
  const orgDocs = new Set<string>();
  const stepIds = new Set<string>();

  steps.forEach((step, i) => {
    const at = `steps.${i}`;
    if (!KEY.test(step.step_id ?? ''))
      errors.push(`${at}.step_id must be lowercase letters, digits, _`);
    if (stepIds.has(step.step_id))
      errors.push(`${at}.step_id "${step.step_id}" is used twice`);
    stepIds.add(step.step_id);
    if (!step.title?.en) errors.push(`${at}.title.en is required`);
    if (!Array.isArray(step.fields)) {
      errors.push(`${at}.fields must be a list`);
      return;
    }
    step.fields.forEach((field, j) => {
      const fat = `${at}.fields.${j}`;
      errors.push(...fieldErrors(field, fat, false));
      if (keys.has(field.key))
        errors.push(`${fat}.key "${field.key}" is used twice`);
      keys.set(field.key, field);
      if (field.maps_to) {
        if (mapped.has(field.maps_to))
          errors.push(`${fat}.maps_to "${field.maps_to}" is used twice`);
        mapped.add(field.maps_to);
      }
      if (field.org_document) {
        if (orgDocs.has(field.org_document))
          errors.push(
            `${fat}.org_document "${field.org_document}" is used twice`,
          );
        orgDocs.add(field.org_document);
      }
    });
  });

  for (const [key, field] of keys) {
    if (field.visible_if && !keys.has(field.visible_if.field)) {
      errors.push(
        `${key}.visible_if refers to unknown field "${field.visible_if.field}"`,
      );
    }
  }
  return errors;
}

function fieldErrors(field: FieldDef, at: string, nested: boolean): string[] {
  const errors: string[] = [];
  if (!KEY.test(field.key ?? ''))
    errors.push(`${at}.key must be lowercase letters, digits, _`);
  if (!FIELD_TYPES.includes(field.type)) {
    errors.push(
      `${at}.type "${String(field.type)}" is not one of ${FIELD_TYPES.join(', ')}`,
    );
    return errors;
  }
  if (nested && !NESTED_TYPES.has(field.type))
    errors.push(`${at}.type "${field.type}" is not allowed inside a group`);
  if (!field.label?.en) errors.push(`${at}.label.en is required`);
  if (typeof field.required !== 'boolean')
    errors.push(`${at}.required must be true or false`);
  if (
    (field.type === 'select' || field.type === 'multi_select') &&
    !field.options?.length
  ) {
    errors.push(`${at}.options are required for ${field.type}`);
  }
  if (field.validation?.regex) {
    try {
      new RegExp(field.validation.regex);
    } catch {
      errors.push(`${at}.validation.regex is not a valid pattern`);
    }
  }
  if (field.maps_to && !isMapsTo(field.maps_to))
    errors.push(`${at}.maps_to "${String(field.maps_to)}" is not allowed`);
  if (field.maps_to === 'location' && field.type !== 'location')
    errors.push(`${at}: only a location field maps to location`);
  if (field.org_document !== undefined) {
    if (field.type !== 'document')
      errors.push(`${at}: only a document field has an org_document`);
    else if (!KEY.test(field.org_document))
      errors.push(`${at}.org_document "${field.org_document}" is not a key`);
  }
  if (field.type === 'object' || field.type === 'object_list') {
    if (!field.fields?.length)
      errors.push(`${at}.fields are required for ${field.type}`);
    field.fields?.forEach((sub, k) =>
      errors.push(...fieldErrors(sub, `${at}.fields.${k}`, true)),
    );
  }
  return errors;
}

const isMapsTo = (value: string): value is MapsTo =>
  (MAPS_TO as readonly string[]).includes(value) ||
  /^details\.[a-z][a-z0-9_]{0,59}$/.test(value);

// ── Values (a partner saving a step) ───────────────────────────────────────

export interface ValueContext {
  /** Uploaded files must live under this person's `KO-documents/<pii_id>/`. */
  piiId: string;
}

/** The cleaned value, or the sentence explaining why it was refused. */
export type Checked =
  { ok: true; value: unknown } | { ok: false; error: string };

const fail = (error: string): Checked => ({ ok: false, error });
const ok = (value: unknown): Checked => ({ ok: true, value });

export function checkValue(
  field: FieldDef,
  value: unknown,
  ctx: ValueContext,
): Checked {
  const v = field.validation ?? {};
  switch (field.type) {
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string') return fail(`${field.key} must be text`);
      const text = value.trim();
      const max = v.max_length ?? (field.type === 'text' ? 300 : 2000);
      if (text.length < (v.min_length ?? 0))
        return fail(`${field.key} must be at least ${v.min_length} characters`);
      if (text.length > max)
        return fail(`${field.key} must be at most ${max} characters`);
      if (v.regex && !new RegExp(v.regex).test(text))
        return fail(`${field.key} is not in the expected format`);
      return ok(text);
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value))
        return fail(`${field.key} must be a number`);
      if (v.min !== undefined && value < v.min)
        return fail(`${field.key} must be at least ${v.min}`);
      if (v.max !== undefined && value > v.max)
        return fail(`${field.key} must be at most ${v.max}`);
      return ok(value);
    }
    case 'boolean':
      if (typeof value !== 'boolean') {
        return fail(`${field.key} must be true or false`);
      }
      return v.must_accept && !value
        ? fail(`${field.key} must be accepted`)
        : ok(value);
    case 'date':
      return typeof value === 'string' &&
        DATE.test(value) &&
        !Number.isNaN(Date.parse(value))
        ? ok(value)
        : fail(`${field.key} must be a date like 2026-10-09`);
    case 'phone': {
      const digits =
        typeof value === 'string' ? value.replace(/\D/g, '').slice(-10) : '';
      return /^[6-9]\d{9}$/.test(digits)
        ? ok(digits)
        : fail(`${field.key} must be a 10-digit mobile number`);
    }
    case 'email':
      return typeof value === 'string' &&
        EMAIL.test(value.trim()) &&
        value.length <= 120
        ? ok(value.trim().toLowerCase())
        : fail(`${field.key} must be an email address`);
    case 'pincode':
      return typeof value === 'string' && /^\d{6}$/.test(value.trim())
        ? ok(value.trim())
        : fail(`${field.key} must be a 6-digit pincode`);
    case 'select':
      return typeof value === 'string' &&
        (field.options ?? []).some((o) => o.value === value)
        ? ok(value)
        : fail(`${field.key} must be one of the listed options`);
    case 'multi_select': {
      const allowed = new Set((field.options ?? []).map((o) => o.value));
      if (
        !Array.isArray(value) ||
        !value.every((x) => typeof x === 'string' && allowed.has(x))
      ) {
        return fail(`${field.key} must be a list of the listed options`);
      }
      const unique = [...new Set(value as string[])];
      if (v.max_items !== undefined && unique.length > v.max_items)
        return fail(`${field.key} allows at most ${v.max_items}`);
      return ok(unique);
    }
    case 'file': {
      const path = filePath(value);
      if (!path)
        return fail(`${field.key} must be an uploaded file ({ path })`);
      return ownPath(path, ctx)
        ? ok({ path })
        : fail(`${field.key} must be a file you uploaded`);
    }
    case 'document': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return fail(`${field.key} must be { files: [path], number? }`);
      }
      const doc = value as Record<string, unknown>;
      const files = Array.isArray(doc.files) ? doc.files : [];
      const maxFiles = v.max_items ?? 2;
      if (
        files.length === 0 ||
        files.length > maxFiles ||
        !files.every((f) => typeof f === 'string')
      ) {
        return fail(`${field.key} needs 1 to ${maxFiles} uploaded files`);
      }
      if (!files.every((f) => ownPath(f, ctx)))
        return fail(`${field.key} must use files you uploaded`);
      const number =
        typeof doc.number === 'string'
          ? doc.number.trim().toUpperCase()
          : undefined;
      if (v.number_required && !number)
        return fail(`${field.key} needs the document number`);
      if (number && v.regex && !new RegExp(v.regex).test(number))
        return fail(`${field.key} number is not in the expected format`);
      return ok({
        files: [...new Set(files)],
        ...(number ? { number } : {}),
      });
    }
    case 'location': {
      if (!value || typeof value !== 'object')
        return fail(`${field.key} must be { lat, lng }`);
      const loc = value as Record<string, unknown>;
      const lat = Number(loc.lat);
      const lng = Number(loc.lng);
      if (!isIndiaFix(lat, lng))
        return fail(`${field.key} is not a location in India`);
      const accuracy =
        typeof loc.accuracy === 'number' && loc.accuracy >= 0
          ? loc.accuracy
          : undefined;
      const capturedAt =
        typeof loc.captured_at === 'string' &&
        !Number.isNaN(Date.parse(loc.captured_at))
          ? loc.captured_at
          : undefined;
      return ok({
        lat,
        lng,
        ...(accuracy !== undefined ? { accuracy } : {}),
        ...(capturedAt ? { captured_at: capturedAt } : {}),
      });
    }
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return fail(`${field.key} must be a group of values`);
      return checkGroup(field, value as RawData, ctx, field.key);
    }
    case 'object_list': {
      if (!Array.isArray(value)) return fail(`${field.key} must be a list`);
      const max = v.max_items ?? 20;
      if (value.length > max)
        return fail(`${field.key} allows at most ${max} rows`);
      const rows: RawData[] = [];
      for (let i = 0; i < value.length; i++) {
        const row: unknown = value[i];
        if (!row || typeof row !== 'object' || Array.isArray(row))
          return fail(`${field.key}.${i} must be a group of values`);
        const checked = checkGroup(
          field,
          row as RawData,
          ctx,
          `${field.key}.${i}`,
        );
        if (!checked.ok) return checked;
        rows.push(checked.value as RawData);
      }
      return ok(rows);
    }
  }
}

function checkGroup(
  field: FieldDef,
  group: RawData,
  ctx: ValueContext,
  at: string,
): Checked {
  const out: RawData = {};
  const subs = new Map((field.fields ?? []).map((f) => [f.key, f]));
  for (const [key, raw] of Object.entries(group)) {
    const sub = subs.get(key);
    if (!sub) return fail(`${at}.${key} is not a field of this group`);
    if (raw === null || raw === undefined || raw === '') continue;
    const checked = checkValue(sub, raw, ctx);
    if (!checked.ok) return fail(`${at}.${checked.error}`);
    out[key] = checked.value;
  }
  for (const sub of subs.values()) {
    if (sub.required && isEmpty(out[sub.key]))
      return fail(`${at}.${sub.key} is required`);
  }
  return ok(out);
}

const filePath = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).path === 'string'
  ) {
    return (value as { path: string }).path;
  }
  return null;
};

const ownPath = (path: string, ctx: ValueContext): boolean =>
  path.startsWith(`KO-documents/${ctx.piiId}/`) &&
  !path.includes('..') &&
  path.length < 300;

export const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

// ── Reading a form back ────────────────────────────────────────────────────

/** Active steps in order, each with its top-level fields. */
export const activeSteps = (steps: StepDef[]): StepDef[] =>
  steps.filter((s) => s.is_active).sort((a, b) => a.order - b.order);

export function fieldIndex(steps: StepDef[]): Map<string, FieldDef> {
  return new Map(
    activeSteps(steps).flatMap((s) => s.fields.map((f) => [f.key, f] as const)),
  );
}

export function isVisible(field: FieldDef, raw: RawData): boolean {
  const rule = field.visible_if;
  if (!rule) return true;
  const other = raw[rule.field];
  switch (rule.op) {
    case 'eq':
      return other === rule.value;
    case 'ne':
      return other !== rule.value;
    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(other);
    case 'filled':
      return !isEmpty(other);
  }
}

/** Required, visible, active fields with no value — what blocks a submit. */
export function missingRequired(steps: StepDef[], raw: RawData): string[] {
  return activeSteps(steps)
    .flatMap((s) => s.fields)
    .filter((f) => f.required && isVisible(f, raw) && isEmpty(raw[f.key]))
    .map((f) => f.key);
}

export function progress(
  steps: StepDef[],
  raw: RawData,
): { completion_pct: number; completed_steps: string[] } {
  const active = activeSteps(steps);
  const required = active
    .flatMap((s) => s.fields)
    .filter((f) => f.required && isVisible(f, raw));
  const filled = required.filter((f) => !isEmpty(raw[f.key])).length;
  const completed_steps = active
    .filter((s) =>
      s.fields.every(
        (f) => !f.required || !isVisible(f, raw) || !isEmpty(raw[f.key]),
      ),
    )
    .map((s) => s.step_id);
  return {
    completion_pct:
      required.length === 0
        ? 100
        : Math.round((filled / required.length) * 100),
    completed_steps,
  };
}

/** Required, visible document fields — every one must be verified to approve. */
export function requiredDocuments(steps: StepDef[], raw: RawData): string[] {
  return activeSteps(steps)
    .flatMap((s) => s.fields)
    .filter((f) => f.type === 'document' && f.required && isVisible(f, raw))
    .map((f) => f.key);
}

export function documentKeys(steps: StepDef[]): string[] {
  return activeSteps(steps)
    .flatMap((s) => s.fields)
    .filter((f) => f.type === 'document')
    .map((f) => f.key);
}

/** The first location value on the form, as a GeoJSON point. */
export function locationOf(steps: StepDef[], raw: RawData): GeoPoint | null {
  for (const field of activeSteps(steps).flatMap((s) => s.fields)) {
    if (field.type !== 'location') continue;
    const value = raw[field.key] as
      { lat?: unknown; lng?: unknown } | undefined;
    if (value && typeof value.lat === 'number' && typeof value.lng === 'number')
      return toPoint(value.lat, value.lng);
  }
  return null;
}

export interface Mapped {
  profile: Record<string, unknown> & { details?: Record<string, unknown> };
  location: GeoPoint | null;
}

/** `raw_data` → partner record, following each field's `maps_to`. */
export function mapProfile(steps: StepDef[], raw: RawData): Mapped {
  const profile: Mapped['profile'] = {};
  let location: GeoPoint | null = null;
  for (const field of activeSteps(steps).flatMap((s) => s.fields)) {
    const value = raw[field.key];
    if (!field.maps_to || isEmpty(value) || !isVisible(field, raw)) continue;
    if (field.maps_to === 'location') {
      const loc = value as { lat: number; lng: number };
      location = toPoint(loc.lat, loc.lng);
    } else if (field.maps_to.startsWith('details.')) {
      profile.details = {
        ...(profile.details ?? {}),
        [field.maps_to.slice(8)]: value,
      };
    } else {
      profile[field.maps_to] =
        field.maps_to === 'state' && typeof value === 'string'
          ? value.toUpperCase()
          : value;
    }
  }
  return { profile, location: location ?? locationOf(steps, raw) };
}

/** Just enough for the desk's list and search, refreshed on every save. */
export function previewOf(
  steps: StepDef[],
  raw: RawData,
): { name?: string; district?: string; state?: string; pincode?: string } {
  const { profile } = mapProfile(steps, raw);
  const pick = (k: string) =>
    typeof profile[k] === 'string' ? profile[k] : undefined;
  return {
    ...(pick('name') ? { name: pick('name') } : {}),
    ...(pick('district') ? { district: pick('district') } : {}),
    ...(pick('state') ? { state: pick('state') } : {}),
    ...(pick('pincode') ? { pincode: pick('pincode') } : {}),
  };
}

/** Every stored file path on the form, to sign in one batch. */
export function filePaths(steps: StepDef[], raw: RawData): string[] {
  const paths: string[] = [];
  const walk = (fields: FieldDef[], data: RawData) => {
    for (const field of fields) {
      const value = data[field.key];
      if (isEmpty(value)) continue;
      if (field.type === 'file') {
        const path = filePath(value);
        if (path) paths.push(path);
      } else if (field.type === 'document') {
        paths.push(
          ...(((value as { files?: unknown }).files as string[] | undefined) ??
            []),
        );
      } else if (field.type === 'object' && field.fields) {
        walk(field.fields, value as RawData);
      } else if (field.type === 'object_list' && field.fields) {
        for (const row of value as RawData[]) walk(field.fields, row);
      }
    }
  };
  walk(
    activeSteps(steps).flatMap((s) => s.fields),
    raw,
  );
  return paths;
}

/** A copy of `raw_data` with signed `url` / `urls` next to every file path. */
export function withUrls(
  steps: StepDef[],
  raw: RawData,
  urls: Map<string, string>,
): RawData {
  const dress = (fields: FieldDef[], data: RawData): RawData => {
    const out: RawData = { ...data };
    for (const field of fields) {
      const value = data[field.key];
      if (isEmpty(value)) continue;
      if (field.type === 'file') {
        const path = filePath(value);
        if (path) out[field.key] = { path, url: urls.get(path) ?? null };
      } else if (field.type === 'document') {
        const doc = value as { files?: string[] };
        out[field.key] = {
          ...doc,
          urls: (doc.files ?? []).map((p) => urls.get(p) ?? null),
        };
      } else if (field.type === 'object' && field.fields) {
        out[field.key] = dress(field.fields, value as RawData);
      } else if (field.type === 'object_list' && field.fields) {
        out[field.key] = (value as RawData[]).map((row) =>
          dress(field.fields as FieldDef[], row),
        );
      }
    }
    return out;
  };
  return dress(
    activeSteps(steps).flatMap((s) => s.fields),
    raw,
  );
}
