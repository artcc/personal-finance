import { ApiProperty } from '@nestjs/swagger';
import { PageDto, SourceArchiveDto } from '../../../shared/http/financial.dto.js';

export class AccountInputDto {
  @ApiProperty({ type: String, maxLength: 120 }) name!: string;
  @ApiProperty({ type: String, nullable: true, maxLength: 120 }) institution!: string | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 120 }) reference!: string | null;
  @ApiProperty({ type: String, enum: ['EUR'] }) currency!: 'EUR';
}
export class AccountUpdateDto extends AccountInputDto {
  @ApiProperty({ type: Number, minimum: 1 }) expectedVersion!: number;
}
export class AccountDto extends AccountInputDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, nullable: true }) archivedFromMonth!: string | null;
  @ApiProperty({ type: Number }) spaceCount!: number;
}
export class AccountsPageDto extends PageDto {
  @ApiProperty({ type: AccountDto, isArray: true }) items!: AccountDto[];
}
export class SpaceInputDto {
  @ApiProperty({ type: String, maxLength: 120 }) name!: string;
}
export class SpaceUpdateDto extends SpaceInputDto {
  @ApiProperty({ type: Number }) expectedVersion!: number;
}
export class SpaceDto extends SpaceInputDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) accountId!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, nullable: true }) archivedFromMonth!: string | null;
}
export class SpacesPageDto extends PageDto {
  @ApiProperty({ type: SpaceDto, isArray: true }) items!: SpaceDto[];
}
export class ArchiveMonthDto {
  @ApiProperty({ type: String }) archivedFromMonth!: string;
}
export class DestinationUsageDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String, enum: ['income', 'commitment'] }) kind!: 'income' | 'commitment';
  @ApiProperty({ type: String }) name!: string;
}
export class AccountArchiveDto extends SourceArchiveDto {
  @ApiProperty({ type: String, isArray: true, maxItems: 100 }) spaceIds!: string[];
}
export class ArchivePreviewDto extends AccountArchiveDto {
  @ApiProperty({ type: SpaceDto, isArray: true }) spaces!: SpaceDto[];
  @ApiProperty({ type: DestinationUsageDto, isArray: true }) references!: DestinationUsageDto[];
  @ApiProperty({ type: Number }) referenceCount!: number;
}
