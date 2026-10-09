import { money } from '@modules/catalog/catalog.domain';

/**
 * Draft-order rules. A Vistaar draft is the partner's cart saved for one
 * customer, written in the `form_data` shape the B2B portal's `customer`
 * entry path already uses, so a draft reads the same whoever wrote it.
 */

/** A `form_data.products[]` line, B2B's shape. */
export interface DraftProduct {
  id: string;
  productName: string;
  variant: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  mrp: number;
  gstPercent: number;
  discount: number;
  total: number;
  weight: number;
  inStock: boolean;
  _source: 'products';
  imageUrl?: string;
}

interface DraftAddress {
  label: string;
  line1: string;
  line2: string;
  line3: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

/**
 * `form_data` as the B2B portal's `customer` path writes it. What a cart
 * does not know (addresses, payment, courier) stays at the portal's own
 * empty values and is filled at checkout.
 */
export interface DraftFormData {
  customerType: string | null;
  orderId: string;
  leadId: string;
  customerName: string;
  businessName: string;
  contactNumber: string;
  email: string;
  gstNumber: string;
  shippingAddresses: DraftAddress[];
  billingAddress: DraftAddress;
  sameAsBilling: boolean;
  profileData: Record<string, never>;
  orderType: string;
  customization: {
    label: string[];
    packaging: string[];
    material: string[];
    otherComments: string;
    labelOther: string;
    packagingOther: string;
    materialOther: string;
    attachments: string[];
  };
  products: DraftProduct[];
  priceType: string;
  transportMode: string;
  orderWeight: string;
  preferredCourier: string;
  notes: string;
  quotationId: string;
  discountCode: string;
  codeType: string | null;
  codeValue: string;
  codeApplied: boolean;
  payment: {
    paymentMode: string;
    suggestedPrepaid: number;
    confirmedPrepaid: number;
    prepaidAcceptable: boolean;
    advancePct: number;
    advanceAmount: number;
    codAmount: number;
    utrInfo: string[];
    couponCode: string;
    couponDiscount: number;
    termsAccepted: boolean;
    otpVerified: boolean;
    otpCode: string;
    rtgsPayments: string[];
  };
}

/** Who a draft is for, as the shared identity records know them. */
export interface DraftCustomer {
  pii_id: string;
  contact_id: string | null;
  lead_id: string | null;
  name: string | null;
  phone: string | null;
}

/** A cart line as the draft needs it: priced live, with its GST. */
export interface DraftSourceLine {
  sku: string;
  product_name: string;
  product_image: string | null;
  size_label: string;
  price: number;
  mrp: number;
  gst: number;
  quantity: number;
  line_total: number;
  available: boolean;
}

/** `app_counters.count` → the id the other writers hand out. */
export function draftOrderId(count: number): string {
  return `DFT-${count}`;
}

export function productsFrom(
  lines: readonly DraftSourceLine[],
): DraftProduct[] {
  return lines.map((l) => ({
    id: l.sku,
    productName: l.product_name,
    variant: l.size_label,
    sku: l.sku,
    quantity: l.quantity,
    unitPrice: l.price,
    mrp: l.mrp,
    gstPercent: l.gst,
    discount: 0,
    total: l.line_total,
    weight: 0,
    inStock: l.available,
    _source: 'products',
    ...(l.product_image ? { imageUrl: l.product_image } : {}),
  }));
}

export function grandTotalOf(products: readonly DraftProduct[]): number {
  return money(products.reduce((sum, p) => sum + p.total, 0));
}

export function itemCountOf(products: readonly DraftProduct[]): number {
  return products.reduce((sum, p) => sum + p.quantity, 0);
}

/** What a restore puts back in the cart; the cart re-prices and re-caps it. */
export function restorableLines(
  products: readonly Pick<DraftProduct, 'sku' | 'quantity'>[],
): { sku: string; quantity: number }[] {
  return products
    .filter((p) => typeof p.sku === 'string' && p.quantity > 0)
    .map((p) => ({ sku: p.sku, quantity: p.quantity }));
}

function emptyAddress(label: string): DraftAddress {
  return {
    label,
    line1: '',
    line2: '',
    line3: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
  };
}

/**
 * The `form_data` of a Vistaar draft. `customer` is `null` for the partner's
 * own shop stock.
 */
export function formDataFor(
  customer: DraftCustomer | null,
  products: DraftProduct[],
): DraftFormData {
  const name = customer?.name ?? '';

  return {
    // Vistaar partners sell to farmers; own stock has no customer type.
    customerType: customer ? 'farmer' : null,
    orderId: '',
    leadId: customer?.lead_id ?? '',
    customerName: name,
    businessName: name,
    contactNumber: customer?.phone ?? '',
    email: '',
    gstNumber: '',
    shippingAddresses: [emptyAddress('Primary')],
    billingAddress: emptyAddress('Billing'),
    sameAsBilling: true,
    profileData: {},
    orderType: 'new',
    customization: {
      label: [],
      packaging: [],
      material: [],
      otherComments: '',
      labelOther: '',
      packagingOther: '',
      materialOther: '',
      attachments: [],
    },
    products,
    priceType: '',
    transportMode: 'delivery',
    orderWeight: '',
    preferredCourier: '',
    notes: '',
    quotationId: '',
    discountCode: '',
    codeType: null,
    codeValue: '',
    codeApplied: false,
    payment: {
      paymentMode: '',
      suggestedPrepaid: 0,
      confirmedPrepaid: 0,
      prepaidAcceptable: false,
      advancePct: 0,
      advanceAmount: 0,
      codAmount: 0,
      utrInfo: [],
      couponCode: '',
      couponDiscount: 0,
      termsAccepted: false,
      otpVerified: false,
      otpCode: '',
      rtgsPayments: [],
    },
  };
}
