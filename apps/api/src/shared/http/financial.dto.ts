import {
  ApiProperty,
  ApiPropertyOptional,
  ApiCookieAuth,
  ApiHeader,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';
import { HttpErrorDto } from '../http-error.dto.js';
import type { Money } from '../domain/money.js';

export class MoneyDto implements Money {
  @ApiProperty({ type: String, enum: ['EUR'] }) currency!: 'EUR';
  @ApiProperty({ type: String, pattern: '^-?(0|[1-9][0-9]*)$' }) minorUnits!: string;
}
export class MoneyInputDto implements Money {
  @ApiProperty({ type: String, enum: ['EUR'] }) currency!: 'EUR';
  @ApiProperty({ type: String, pattern: '^(0|[1-9][0-9]{0,14})$', maxLength: 15 })
  minorUnits!: string;
}
export class DestinationDto {
  @ApiProperty({ type: String, format: 'uuid' }) accountId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) spaceId!: string | null;
}
export class DefinitionDto {
  @ApiProperty({ type: String, maxLength: 120 }) name!: string;
  @ApiProperty({ type: String, example: '2026-10' }) effectiveFromMonth!: string;
  @ApiProperty({ type: String, format: 'date' }) startsOn!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) endsOn!: string | null;
  @ApiProperty({ type: () => DestinationDto }) destination!: DestinationDto;
}
export class ListQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 }) page?: number;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 25 }) pageSize?: number;
  @ApiPropertyOptional({ type: String }) q?: string;
  @ApiPropertyOptional({ type: String, enum: ['true', 'false'] }) includeArchived?: string;
  @ApiPropertyOptional({ type: String, example: '2026-10' }) month?: string;
}
export class PageDto {
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) pageSize!: number;
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: String }) month!: string;
}
export class SourceListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    type: String,
    enum: [
      'all',
      'salary',
      'professional',
      'fixed',
      'subscription',
      'shared',
      'financing',
      'investment',
    ],
  })
  kind?: string;
  @ApiPropertyOptional({ type: String }) accountId?: string;
}
export class SourceArchiveDto {
  @ApiProperty({ type: Number, minimum: 1 }) expectedVersion!: number;
  @ApiProperty({ type: String }) archivedFromMonth!: string;
}
export const FinancialApi = () =>
  applyDecorators(
    ApiCookieAuth('session'),
    ApiUnauthorizedResponse({ type: HttpErrorDto }),
    ApiForbiddenResponse({ type: HttpErrorDto }),
    ApiNotFoundResponse({ type: HttpErrorDto }),
    ApiConflictResponse({ type: HttpErrorDto }),
    ApiUnprocessableEntityResponse({ type: HttpErrorDto }),
  );
export const CsrfHeader = () =>
  ApiHeader({ name: 'X-CSRF-Token', required: true, schema: { type: 'string' } });
