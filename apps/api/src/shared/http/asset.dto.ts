import { ApiProperty } from '@nestjs/swagger';
import { CommitmentDefinitionDto } from '../../modules/commitments/http/commitments.dto.js';
import { MoneyDto, MoneyInputDto, PageDto } from './financial.dto.js';

export class PlanningLinkInputDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) sourceId!: string | null;
  @ApiProperty({ type: Number, nullable: true }) expectedVersion!: number | null;
  @ApiProperty({ type: () => CommitmentDefinitionDto, nullable: true })
  definition!: CommitmentDefinitionDto | null;
}
export class LinkedPlanDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: () => CommitmentDefinitionDto }) definition!: CommitmentDefinitionDto;
  @ApiProperty({ type: String, nullable: true }) archivedFromMonth!: string | null;
  @ApiProperty({ type: Boolean }) active!: boolean;
  @ApiProperty({ type: () => MoneyDto }) monthlyCharge!: MoneyDto;
}
export class DatedAmountDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'date' }) asOf!: string;
  @ApiProperty({ type: () => MoneyDto }) amount!: MoneyDto;
}
export class ReportAmountDto {
  @ApiProperty({ type: Number }) expectedVersion!: number;
  @ApiProperty({ type: String, format: 'date' }) asOf!: string;
  @ApiProperty({ type: () => MoneyInputDto }) amount!: MoneyInputDto;
}
export class ReportsPageDto extends PageDto {
  @ApiProperty({ type: DatedAmountDto, isArray: true }) items!: DatedAmountDto[];
}
export class AssetReasonDto {
  @ApiProperty({ type: Number }) expectedVersion!: number;
  @ApiProperty({ type: String, minLength: 1, maxLength: 500 }) reason!: string;
}
