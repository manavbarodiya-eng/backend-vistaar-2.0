import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SaveDraftDto {
  @ApiProperty({
    description:
      'The whole form: steps → fields. Checked in full on publish; a draft may be saved half-done. ' +
      'See ONBOARDING-HO.md for every field type.',
    example: [
      {
        step_id: 'personal',
        order: 1,
        title: { en: 'Personal details', hi: 'व्यक्तिगत जानकारी' },
        is_active: true,
        fields: [
          {
            key: 'full_name',
            type: 'text',
            label: { en: 'Full name' },
            required: true,
            maps_to: 'name',
          },
        ],
      },
    ],
  })
  @IsArray()
  @Allow()
  steps!: unknown[];

  @ApiPropertyOptional({ example: 'Added GSTIN for agents' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
