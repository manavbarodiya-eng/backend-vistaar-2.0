import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import type { DraftCustomer } from '../draft-order.domain';

interface PiiRow {
  pii_id: string;
  phone_number?: string[];
}

interface LeadRow {
  lead_id?: string;
  first_name?: string;
  last_name?: string;
}

interface ContactRow {
  contact_id?: string;
  pii_id?: string;
}

/**
 * Read-only lookups on ko-sales' identity records (`piis`, `leads_v2`,
 * `contacts_v2`), which a draft copies its customer fields from. Every read
 * here rides an index those collections already have on `pii_id`,
 * `phone_number` or `contact_id`. Nothing here writes.
 */
@Injectable()
export class CustomerLookupRepository {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async byPiiId(piiId: string): Promise<DraftCustomer | null> {
    const [pii, lead, contact] = await Promise.all([
      this.connection
        .collection<PiiRow>('piis')
        .findOne(
          { pii_id: piiId },
          { projection: { pii_id: 1, phone_number: 1 } },
        ),
      this.connection
        .collection<LeadRow & { pii_id: string; updated_at?: Date }>('leads_v2')
        .findOne(
          { pii_id: piiId },
          {
            sort: { updated_at: -1 },
            projection: { lead_id: 1, first_name: 1, last_name: 1 },
          },
        ),
      this.connection
        .collection<ContactRow>('contacts_v2')
        .findOne({ pii_id: piiId }, { projection: { contact_id: 1 } }),
    ]);

    if (!pii) return null;

    const name = [lead?.first_name, lead?.last_name]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');

    return {
      pii_id: pii.pii_id,
      contact_id: contact?.contact_id ?? null,
      lead_id: lead?.lead_id ?? null,
      name: name || null,
      phone: pii.phone_number?.[0] ?? null,
    };
  }

  /**
   * The person a draft was for. `draft_orders` holds no `pii_id`, so it is
   * found again through the contact, else the phone.
   */
  async piiIdFor(
    contactId: string | null,
    phone: string | null,
  ): Promise<string | null> {
    if (contactId) {
      const contact = await this.connection
        .collection<ContactRow>('contacts_v2')
        .findOne({ contact_id: contactId }, { projection: { pii_id: 1 } });
      if (contact?.pii_id) return contact.pii_id;
    }

    if (phone) {
      const pii = await this.connection
        .collection<PiiRow>('piis')
        .findOne({ phone_number: phone }, { projection: { pii_id: 1 } });
      if (pii) return pii.pii_id;
    }

    return null;
  }
}
