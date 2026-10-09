import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SaveOnboardingDto {
  @ApiPropertyOptional({
    example: 'vistaar_agent',
    description:
      'Required on the first save; picks the form. Can change until the first submit.',
  })
  @IsOptional()
  @Matches(/^[a-z][a-z0-9_]{1,40}$/)
  cohort?: string;

  @ApiPropertyOptional({
    example: 'personal',
    description: 'The step the app is on (resume point)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  step_id?: string;

  @ApiProperty({
    example: {
      full_name: 'Rajesh Kumar',
      gps: { lat: 23.25, lng: 77.41, accuracy: 12 },
    },
    description:
      'Field key → value. Only these keys change; `null` clears a field.',
  })
  @IsObject()
  @Allow()
  data!: Record<string, unknown>;
}

export class AdminEditDto {
  @ApiProperty({
    example: { full_name: 'Rajesh Kumar Yadav' },
    description: 'Field key → corrected value; audited',
  })
  @IsObject()
  @Allow()
  data!: Record<string, unknown>;
}

export class ReviewDocumentDto {
  @ApiProperty({ enum: ['verified', 'rejected'] })
  @IsIn(['verified', 'rejected'])
  decision!: 'verified' | 'rejected';

  @ApiPropertyOptional({
    example: 'Photo is blurred — the number cannot be read',
    description: 'Required to reject',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class RequestChangesDto {
  @ApiProperty({
    example: { full_name: 'Use the name exactly as on Aadhaar' },
    description:
      'Field key → note for the partner. Rejected documents are added automatically.',
  })
  @IsObject()
  remarks!: Record<string, string>;
}

export class ReasonDto {
  @ApiProperty({
    example: 'Duplicate of an existing franchise in the same village',
  })
  @IsString()
  @MaxLength(300)
  reason!: string;
}

export class OptionalReasonDto {
  @ApiPropertyOptional({ example: 'Verified by phone' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class OwnerDto {
  @ApiProperty({
    example: 'A0-2691',
    description: '`agents_v2.agent_id` of an active HO user',
  })
  @Matches(/^A0-\d+$/)
  owner_agent_id!: string;
}
