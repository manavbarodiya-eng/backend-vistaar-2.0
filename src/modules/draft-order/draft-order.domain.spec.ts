import {
  draftOrderId,
  formDataFor,
  grandTotalOf,
  itemCountOf,
  productsFrom,
  restorableLines,
  type DraftCustomer,
  type DraftSourceLine,
} from './draft-order.domain';

function line(overrides: Partial<DraftSourceLine> = {}): DraftSourceLine {
  return {
    sku: 'K-1',
    product_name: 'Humic',
    product_image: 'https://cdn/h.webp',
    size_label: '1 KG',
    price: 100.1,
    mrp: 150,
    gst: 18,
    quantity: 2,
    line_total: 200.2,
    available: true,
    ...overrides,
  };
}

const CUSTOMER: DraftCustomer = {
  pii_id: 'PII-1',
  contact_id: 'C0-1',
  lead_id: 'L-1',
  name: 'Mohan Rao',
  phone: '8247554977',
};

describe('draft-order domain', () => {
  it('numbers drafts the way every writer does', () => {
    expect(draftOrderId(96)).toBe('DFT-96');
  });

  it("writes lines in B2B's products shape", () => {
    expect(productsFrom([line()])).toEqual([
      {
        id: 'K-1',
        productName: 'Humic',
        variant: '1 KG',
        sku: 'K-1',
        quantity: 2,
        unitPrice: 100.1,
        mrp: 150,
        gstPercent: 18,
        discount: 0,
        total: 200.2,
        weight: 0,
        inStock: true,
        _source: 'products',
        imageUrl: 'https://cdn/h.webp',
      },
    ]);
  });

  it('leaves imageUrl off when the pack has no image, as B2B rows do', () => {
    const [product] = productsFrom([line({ product_image: null })]);
    expect(product).not.toHaveProperty('imageUrl');
  });

  it('totals to the paisa and counts packs', () => {
    const products = productsFrom([
      line({ line_total: 0.1 }),
      line({ sku: 'K-2', line_total: 0.2, quantity: 3 }),
    ]);
    expect(grandTotalOf(products)).toBe(0.3);
    expect(itemCountOf(products)).toBe(5);
  });

  it('restores sku + quantity only, skipping broken lines', () => {
    expect(
      restorableLines([
        { sku: 'K-1', quantity: 2 },
        { sku: 'K-2', quantity: 0 },
      ]),
    ).toEqual([{ sku: 'K-1', quantity: 2 }]);
  });

  it("copies the customer into the portal's form fields", () => {
    const form = formDataFor(CUSTOMER, []);
    expect(form).toMatchObject({
      customerType: 'farmer',
      leadId: 'L-1',
      customerName: 'Mohan Rao',
      businessName: 'Mohan Rao',
      contactNumber: '8247554977',
      orderType: 'new',
    });
    expect(form.shippingAddresses).toHaveLength(1);
  });

  it('own stock has no customer fields', () => {
    expect(formDataFor(null, [])).toMatchObject({
      customerType: null,
      leadId: '',
      customerName: '',
      contactNumber: '',
    });
  });
});
