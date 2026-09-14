import { ApiProperty } from '@nestjs/swagger';
import { MoneyInputDto, PageDto } from '../../../shared/http/financial.dto.js';
import type { MoneyDto } from '../../../shared/http/financial.dto.js';
import {
  DatedAmountDto,
  LinkedPlanDto,
  PlanningLinkInputDto,
} from '../../../shared/http/asset.dto.js';

export class FinancingMetadataDto {
  @ApiProperty({ type: String, maxLength: 120 }) name!: string;
  @ApiProperty({ type: String, nullable: true, maxLength: 120 }) lender!: string | null;
  @ApiProperty({ type: () => MoneyInputDto, nullable: true }) originalPrincipal!: MoneyDto | null;
}
export class FinancingCreateDto extends FinancingMetadataDto {
  @ApiProperty({ type: () => PlanningLinkInputDto }) planning!: PlanningLinkInputDto;
}
export class FinancingUpdateDto extends FinancingMetadataDto {
  @ApiProperty({ type: Number }) expectedVersion!: number;
}
export class FinancingDto extends FinancingMetadataDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: () => LinkedPlanDto }) planning!: LinkedPlanDto;
  @ApiProperty({ type: () => DatedAmountDto, nullable: true }) latestDebt!: DatedAmountDto | null;
}
export class FinancingsPageDto extends PageDto {
  @ApiProperty({ type: FinancingDto, isArray: true }) items!: FinancingDto[];
}
