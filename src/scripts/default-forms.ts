/**
 * The starting forms, built from the Vistaar 2.0 PRD (§4 cohorts, §6.1–6.2
 * signup and KYC) and the app UI (branch vistaar-2.0-ui, Signup.tsx and the
 * s1–s11 onboarding steps). HO edits them from the portal afterwards; this
 * only seeds a first version so the app has something to render.
 */
import type { FieldDef, StepDef } from '../modules/onboarding/form.domain';
import type { SubType } from '../modules/onboarding/schemas/cohort.schema';

const l = (en: string, hi?: string): Record<string, string> =>
  hi ? { en, hi } : { en };
const opt = (value: string, en: string, hi?: string) => ({
  value,
  label: l(en, hi),
});

export interface DefaultCohort {
  key: string;
  label: Record<string, string>;
  description: Record<string, string>;
  icon: string;
  order: number;
  sub_types: SubType[];
  details: FieldDef[];
}

const OTHER_SUB_TYPES: SubType[] = [
  {
    key: 'progressive_farmer',
    label: l('Progressive / lead farmer', 'प्रगतिशील किसान'),
  },
  { key: 'agri_student', label: l('Agri student / graduate', 'कृषि छात्र') },
  { key: 'retired_agri_officer', label: l('Retired agri / bank officer') },
  { key: 'fpo_staff', label: l('FPO staff / CEO') },
  { key: 'spray_drone_service', label: l('Spray / drone service provider') },
  { key: 'shg_member', label: l('SHG member (Krishi Sakhi)') },
  { key: 'dealer_salesman', label: l("Dealer's salesman") },
  { key: 'input_shop_helper', label: l('Input shop helper') },
];

export const DEFAULT_COHORTS: DefaultCohort[] = [
  {
    key: 'vistaar_agent',
    label: l('Vistaar Agent', 'विस्तार एजेंट'),
    description: l(
      'Shop owner or village entrepreneur who sells Katyayani products to farmers.',
    ),
    icon: '🏪',
    order: 1,
    sub_types: [],
    // The shop is optional: no details step for a Vistaar Agent.
    details: [],
  },
  {
    key: 'ex_employee',
    label: l('Ex-Katyayani Employee', 'पूर्व कात्यायनी कर्मचारी'),
    description: l(
      'Worked with Katyayani before and wants to keep selling as a partner.',
    ),
    icon: '🤝',
    order: 2,
    sub_types: [],
    details: [
      {
        key: 'employee_code',
        type: 'text',
        label: l('Old employee code'),
        required: true,
        maps_to: 'details.employee_code',
        validation: { min_length: 3, max_length: 20 },
      },
      {
        key: 'last_department',
        type: 'select',
        label: l('Last department'),
        required: true,
        maps_to: 'details.last_department',
        options: [
          'Sales',
          'Marketing',
          'Operations / Logistics',
          'Customer Support',
          'Agronomy',
          'Tech',
          'Finance',
          'HR',
          'Other',
        ].map((d) => opt(d.toLowerCase().replace(/[^a-z]+/g, '_'), d)),
      },
      {
        key: 'exit_year',
        type: 'number',
        label: l('Exit year'),
        required: true,
        maps_to: 'details.exit_year',
        validation: { min: 2010, max: 2030 },
      },
      {
        key: 'relieving_letter',
        type: 'document',
        label: l('Relieving / experience letter'),
        required: true,
        validation: { max_items: 2 },
      },
    ],
  },
  {
    key: 'other_company_employee',
    label: l('Working Professional', 'कामकाजी पेशेवर'),
    description: l(
      'Employed elsewhere and sells Katyayani products alongside.',
    ),
    icon: '💼',
    order: 3,
    sub_types: [],
    details: [
      {
        key: 'employer_name',
        type: 'text',
        label: l('Current employer'),
        required: true,
        maps_to: 'details.employer_name',
      },
      {
        key: 'designation',
        type: 'text',
        label: l('Designation'),
        required: true,
        maps_to: 'details.designation',
      },
      {
        key: 'no_conflict_declaration',
        type: 'boolean',
        required: true,
        validation: { must_accept: true },
        label: l(
          "I declare that selling Katyayani products does not conflict with my current employment, and I will not use my employer's customer data or time for Vistaar orders.",
        ),
      },
    ],
  },
  {
    key: 'consultant',
    label: l('Agri Consultant', 'कृषि सलाहकार'),
    description: l(
      'Agronomist, crop advisor or KVK expert who recommends and orders for farmers.',
    ),
    icon: '🧑‍🔬',
    order: 4,
    sub_types: [],
    details: [
      {
        key: 'qualification',
        type: 'select',
        label: l('Highest qualification'),
        required: true,
        maps_to: 'details.qualification',
        options: [
          'B.Sc Agriculture',
          'M.Sc Agriculture',
          'Diploma in Agriculture',
          'PhD (Agri)',
          'B.Sc Horticulture',
          'Other',
        ].map((q) => opt(q.toLowerCase().replace(/[^a-z]+/g, '_'), q)),
      },
      {
        key: 'specialisation',
        type: 'select',
        label: l('Specialisation'),
        required: true,
        maps_to: 'details.specialisation',
        options: [
          'Agronomy',
          'Plant Protection',
          'Soil Science',
          'Horticulture',
          'Entomology',
          'Plant Pathology',
          'Other',
        ].map((q) => opt(q.toLowerCase().replace(/[^a-z]+/g, '_'), q)),
      },
      {
        key: 'years_experience',
        type: 'number',
        label: l('Years of experience'),
        required: true,
        maps_to: 'details.years_experience',
        validation: { min: 0, max: 60 },
      },
      {
        key: 'qualification_proof',
        type: 'document',
        label: l('Degree / diploma / KVK certificate'),
        required: true,
        validation: { max_items: 2 },
      },
    ],
  },
  {
    key: 'other',
    label: l('Other', 'अन्य'),
    description: l(
      'Progressive farmer, student, FPO staff, spray service provider and more.',
    ),
    icon: '✨',
    order: 5,
    sub_types: OTHER_SUB_TYPES,
    details: [
      {
        key: 'sub_cohort',
        type: 'select',
        label: l('What describes you best'),
        required: true,
        maps_to: 'sub_cohort',
        options: OTHER_SUB_TYPES.map((s) => ({ value: s.key, label: s.label })),
      },
      {
        key: 'selling_plan',
        type: 'textarea',
        label: l('How will you sell Katyayani products?'),
        required: true,
        maps_to: 'details.selling_plan',
        validation: { min_length: 20, max_length: 300 },
      },
    ],
  },
];

/** Shared steps around the cohort's own step. */
export function defaultSteps(cohort: DefaultCohort): StepDef[] {
  return [
    {
      step_id: 'personal',
      order: 1,
      is_active: true,
      icon: 'user',
      title: l('Personal details', 'व्यक्तिगत जानकारी'),
      description: l('Use your name exactly as on Aadhaar.'),
      fields: [
        {
          key: 'full_name',
          type: 'text',
          label: l('Full name (as on Aadhaar)', 'पूरा नाम'),
          required: true,
          maps_to: 'name',
          validation: { min_length: 3, max_length: 100 },
        },
        {
          key: 'email',
          type: 'email',
          label: l('Email (optional)'),
          required: false,
          maps_to: 'email',
        },
        {
          key: 'language_pref',
          type: 'select',
          label: l('Preferred language', 'पसंदीदा भाषा'),
          required: false,
          maps_to: 'details.language_pref',
          options: [
            opt('hi', 'Hindi', 'हिंदी'),
            opt('en', 'English'),
            opt('mr', 'Marathi'),
            opt('gu', 'Gujarati'),
            opt('pa', 'Punjabi'),
            opt('bn', 'Bengali'),
            opt('te', 'Telugu'),
            opt('ta', 'Tamil'),
            opt('kn', 'Kannada'),
          ],
        },
        {
          key: 'profile_photo',
          type: 'file',
          label: l('Profile photo'),
          required: false,
        },
      ],
    },
    {
      step_id: 'location',
      order: 2,
      is_active: true,
      icon: 'map-pin',
      title: l('Where do you work?', 'आप कहाँ काम करते हैं?'),
      description: l(
        'Your location is captured from the phone; it maps you to the nearest Katyayani network.',
      ),
      fields: [
        {
          key: 'gps',
          type: 'location',
          label: l('Current location (GPS)'),
          required: false,
          maps_to: 'location',
        },
        {
          key: 'village',
          type: 'text',
          label: l('Village / town', 'गाँव / शहर'),
          required: true,
          maps_to: 'village',
        },
        {
          key: 'district',
          type: 'text',
          label: l('District', 'ज़िला'),
          required: true,
          maps_to: 'district',
        },
        {
          key: 'state',
          type: 'text',
          label: l('State', 'राज्य'),
          required: true,
          maps_to: 'state',
        },
        {
          key: 'pincode',
          type: 'pincode',
          label: l('Pincode', 'पिनकोड'),
          required: true,
          maps_to: 'pincode',
        },
        {
          key: 'address_line',
          type: 'textarea',
          label: l('Address (optional)'),
          required: false,
          maps_to: 'address_line',
          validation: { max_length: 300 },
        },
      ],
    },
    ...(cohort.details.length
      ? [
          {
            step_id: 'details',
            order: 3,
            is_active: true,
            icon: 'briefcase',
            title: { ...cohort.label, en: `${cohort.label.en} details` },
            fields: cohort.details,
          },
        ]
      : []),
    {
      step_id: 'kyc',
      order: 4,
      is_active: true,
      icon: 'shield-check',
      title: l('KYC documents', 'केवाईसी दस्तावेज़'),
      description: l('Checked by Katyayani before ordering is unlocked.'),
      fields: [
        {
          key: 'aadhaar',
          type: 'document',
          label: l('Aadhaar (front and back)'),
          required: true,
          help: l('12-digit Aadhaar number, and photos of the front and back.'),
          org_document: 'adhar',
          validation: {
            max_items: 2,
            number_required: true,
            regex: '^[2-9]\\d{11}$',
          },
        },
        {
          key: 'pan',
          type: 'document',
          label: l('PAN card'),
          required: true,
          help: l('Needed for TDS on commission.'),
          org_document: 'pan',
          validation: {
            max_items: 1,
            number_required: true,
            regex: '^[A-Z]{5}[0-9]{4}[A-Z]$',
          },
        },
        {
          key: 'bank_proof',
          type: 'document',
          label: l('Cancelled cheque or passbook first page'),
          required: true,
          org_document: 'bank_details',
          validation: { max_items: 1 },
        },
        {
          key: 'bank_account',
          type: 'object',
          label: l('Payout bank account'),
          required: true,
          maps_to: 'details.bank_account',
          fields: [
            {
              key: 'account_holder',
              type: 'text',
              label: l('Account holder name'),
              required: true,
            },
            {
              key: 'account_number',
              type: 'text',
              label: l('Account number'),
              required: true,
              validation: { regex: '^\\d{9,18}$' },
            },
            {
              key: 'ifsc',
              type: 'text',
              label: l('IFSC'),
              required: true,
              validation: { regex: '^[A-Z]{4}0[A-Z0-9]{6}$' },
            },
            {
              key: 'upi_id',
              type: 'text',
              label: l('UPI ID (optional)'),
              required: false,
              validation: { regex: '^[\\w.-]{2,}@[a-zA-Z]{2,}$' },
            },
          ],
        },
        {
          key: 'selfie',
          type: 'document',
          label: l('Selfie holding your Aadhaar'),
          required: true,
          org_document: 'selfie',
          help: l('Take it live — gallery photos are rejected.'),
          validation: { max_items: 1 },
        },
      ],
    },
    {
      step_id: 'agreement',
      order: 5,
      is_active: true,
      icon: 'pen-line',
      title: l('Partner agreement', 'साझेदार अनुबंध'),
      fields: [
        {
          key: 'partner_agreement',
          type: 'boolean',
          required: true,
          validation: { must_accept: true },
          label: l(
            'I have read and agree to the Vistaar Partner Agreement: commission only on delivered orders, no payout for adding farmers or leads, TDS under 194H, payouts only to my own verified account.',
          ),
        },
      ],
    },
  ];
}
