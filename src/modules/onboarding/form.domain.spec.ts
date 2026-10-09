import {
  checkValue,
  configErrors,
  filePaths,
  mapProfile,
  missingRequired,
  progress,
  requiredDocuments,
  withUrls,
  type FieldDef,
  type StepDef,
} from './form.domain';

const en = (text: string) => ({ en: text });
const ctx = { piiId: 'PII-1' };

const steps: StepDef[] = [
  {
    step_id: 'personal',
    order: 1,
    title: en('Personal'),
    is_active: true,
    fields: [
      {
        key: 'full_name',
        type: 'text',
        label: en('Name'),
        required: true,
        maps_to: 'name',
      },
      {
        key: 'email',
        type: 'email',
        label: en('Email'),
        required: false,
        maps_to: 'email',
      },
      { key: 'has_shop', type: 'boolean', label: en('Shop?'), required: true },
      {
        key: 'shop_name',
        type: 'text',
        label: en('Shop'),
        required: true,
        visible_if: { field: 'has_shop', op: 'eq', value: true },
        maps_to: 'details.shop_name',
      },
    ],
  },
  {
    step_id: 'location',
    order: 2,
    title: en('Location'),
    is_active: true,
    fields: [
      {
        key: 'gps',
        type: 'location',
        label: en('GPS'),
        required: true,
        maps_to: 'location',
      },
      {
        key: 'state',
        type: 'text',
        label: en('State'),
        required: true,
        maps_to: 'state',
      },
    ],
  },
  {
    step_id: 'kyc',
    order: 3,
    title: en('KYC'),
    is_active: true,
    fields: [
      {
        key: 'pan',
        type: 'document',
        label: en('PAN'),
        required: true,
        validation: {
          number_required: true,
          regex: '^[A-Z]{5}[0-9]{4}[A-Z]$',
          max_items: 1,
        },
      },
      {
        key: 'crops',
        type: 'object_list',
        label: en('Crops'),
        required: false,
        fields: [
          { key: 'crop', type: 'text', label: en('Crop'), required: true },
          { key: 'photo', type: 'file', label: en('Photo'), required: false },
        ],
      },
    ],
  },
];

describe('configErrors', () => {
  it('accepts a sound form', () => {
    expect(configErrors(steps)).toEqual([]);
  });

  it('demands a required GPS field', () => {
    const noGps = steps.map((s) => ({
      ...s,
      fields: s.fields.filter((f) => f.type !== 'location'),
    }));
    expect(configErrors(noGps).join()).toMatch(/location/);
  });

  it('keeps org_document to one document field per key', () => {
    const doc = (key: string, type: FieldDef['type']): FieldDef => ({
      key,
      type,
      label: en(key),
      required: false,
      org_document: 'pan',
    });
    const errors = configErrors([
      {
        ...steps[1],
        fields: [
          ...steps[1].fields,
          doc('pan_a', 'document'),
          doc('pan_b', 'document'),
          doc('note', 'text'),
        ],
      },
    ]).join(' | ');
    expect(errors).toMatch(/org_document "pan" is used twice/);
    expect(errors).toMatch(/only a document field has an org_document/);
  });

  it('catches duplicate keys, bad types and unknown visibility targets', () => {
    const bad: StepDef[] = [
      {
        ...steps[1],
        fields: [
          ...steps[1].fields,
          { key: 'state', type: 'text', label: en('Again'), required: false },
          {
            key: 'x',
            type: 'nope' as FieldDef['type'],
            label: en('X'),
            required: false,
          },
          {
            key: 'y',
            type: 'text',
            label: en('Y'),
            required: false,
            visible_if: { field: 'ghost', op: 'filled' },
          },
        ],
      },
    ];
    const errors = configErrors(bad).join('\n');
    expect(errors).toMatch(/"state" is used twice/);
    expect(errors).toMatch(/"nope" is not one of/);
    expect(errors).toMatch(/unknown field "ghost"/);
  });
});

describe('checkValue', () => {
  const pan = steps[2].fields[0];
  const gps = steps[1].fields[0];
  const crops = steps[2].fields[1];

  it('normalises a document and enforces its number format', () => {
    expect(
      checkValue(
        pan,
        { files: ['KO-documents/PII-1/pan/a.jpg'], number: 'abcde1234f' },
        ctx,
      ),
    ).toEqual({
      ok: true,
      value: { files: ['KO-documents/PII-1/pan/a.jpg'], number: 'ABCDE1234F' },
    });
    expect(
      checkValue(
        pan,
        { files: ['KO-documents/PII-1/pan/a.jpg'], number: '123' },
        ctx,
      ).ok,
    ).toBe(false);
    expect(
      checkValue(pan, { files: ['KO-documents/PII-1/pan/a.jpg'] }, ctx).ok,
    ).toBe(false);
  });

  it("refuses another partner's file", () => {
    expect(
      checkValue(
        pan,
        { files: ['KO-documents/PII-2/pan/a.jpg'], number: 'ABCDE1234F' },
        ctx,
      ).ok,
    ).toBe(false);
  });

  it('accepts only a GPS fix inside India', () => {
    expect(
      checkValue(gps, { lat: 23.25, lng: 77.41, accuracy: 12 }, ctx).ok,
    ).toBe(true);
    expect(checkValue(gps, { lat: 0, lng: 0 }, ctx).ok).toBe(false);
    expect(checkValue(gps, { lat: 51.5, lng: -0.12 }, ctx).ok).toBe(false);
  });

  it('checks every row of a list against its sub-fields', () => {
    expect(checkValue(crops, [{ crop: 'Wheat' }], ctx).ok).toBe(true);
    expect(
      checkValue(
        crops,
        [{ photo: { path: 'KO-documents/PII-1/crops/p.jpg' } }],
        ctx,
      ),
    ).toEqual({
      ok: false,
      error: 'crops.0.crop is required',
    });
    expect(checkValue(crops, [{ crop: 'Wheat', extra: 1 }], ctx).ok).toBe(
      false,
    );
  });
});

describe('must_accept', () => {
  const consent: FieldDef = {
    key: 'agree',
    type: 'boolean',
    label: en('Agree'),
    required: true,
    validation: { must_accept: true },
  };
  it('only true counts', () => {
    expect(checkValue(consent, true, ctx).ok).toBe(true);
    expect(checkValue(consent, false, ctx)).toEqual({
      ok: false,
      error: 'agree must be accepted',
    });
  });
});

describe('reading a form', () => {
  const raw = {
    full_name: 'Rajesh Kumar',
    has_shop: false,
    gps: { lat: 23.25, lng: 77.41 },
    state: 'Madhya Pradesh',
    pan: { files: ['KO-documents/PII-1/pan/a.jpg'], number: 'ABCDE1234F' },
  };

  it('skips hidden required fields', () => {
    expect(missingRequired(steps, raw)).toEqual([]);
    expect(missingRequired(steps, { ...raw, has_shop: true })).toEqual([
      'shop_name',
    ]);
  });

  it('reports progress per required visible field', () => {
    expect(progress(steps, { full_name: 'R', has_shop: false })).toEqual({
      completion_pct: 40,
      completed_steps: ['personal'],
    });
  });

  it('maps onto the partner record', () => {
    expect(mapProfile(steps, raw)).toEqual({
      profile: { name: 'Rajesh Kumar', state: 'MADHYA PRADESH' },
      location: { type: 'Point', coordinates: [77.41, 23.25] },
    });
  });

  it('lists required documents and signs every file', () => {
    expect(requiredDocuments(steps, raw)).toEqual(['pan']);
    const withCrop = {
      ...raw,
      crops: [
        { crop: 'Wheat', photo: { path: 'KO-documents/PII-1/crops/p.jpg' } },
      ],
    };
    const paths = filePaths(steps, withCrop);
    expect(paths).toEqual([
      'KO-documents/PII-1/pan/a.jpg',
      'KO-documents/PII-1/crops/p.jpg',
    ]);
    const dressed = withUrls(
      steps,
      withCrop,
      new Map(paths.map((p) => [p, `https://signed/${p}`])),
    );
    expect(dressed.pan).toMatchObject({
      urls: ['https://signed/KO-documents/PII-1/pan/a.jpg'],
    });
    expect((dressed.crops as { photo: { url: string } }[])[0].photo.url).toBe(
      'https://signed/KO-documents/PII-1/crops/p.jpg',
    );
  });
});
