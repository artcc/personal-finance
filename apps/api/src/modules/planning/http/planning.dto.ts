import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DestinationDto, MoneyDto, MoneyInputDto } from '../../../shared/http/financial.dto.js';

export class PlanningMonthDto {
  @ApiProperty({ type: String, example: '2026-10' }) month!: string;
}
export class PlanVersionDto {
  @ApiProperty({ type: Number, minimum: 1 }) expectedVersion!: number;
}
export class PlanReasonDto extends PlanVersionDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 500 }) reason!: string;
}
export class PlanCloseDto extends PlanVersionDto {
  @ApiProperty({ type: Boolean }) acknowledgeShortfall!: boolean;
}
export class PlanDestinationDto extends DestinationDto {
  @ApiProperty({ type: String }) accountName!: string;
  @ApiProperty({ type: String, nullable: true }) institution!: string | null;
  @ApiProperty({ type: String, nullable: true }) reference!: string | null;
  @ApiProperty({ type: String, nullable: true }) spaceName!: string | null;
}
export class PlanSourceDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) sourceId!: string;
  @ApiProperty({ type: String }) sourceRevisionId!: string;
  @ApiProperty({ type: Number }) sourceVersion!: number;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: Object, additionalProperties: true }) sourceInput!: Record<string, unknown>;
  @ApiProperty({ type: () => PlanDestinationDto }) destination!: PlanDestinationDto;
}
export class PlanIncomeDto extends PlanSourceDto {
  @ApiProperty({ type: String, enum: ['salary', 'professional'] }) kind!: 'salary' | 'professional';
  @ApiProperty({ type: () => MoneyDto }) expectedCash!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) taxReserve!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) spendableIncome!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) originalExpectedCash!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) originalTaxReserve!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) base!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) vat!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) withholding!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) commission!: MoneyDto;
  @ApiProperty({ type: String, nullable: true }) overrideReason!: string | null;
}
export class PlanDueDto {
  @ApiProperty({ type: String, format: 'date' }) date!: string;
  @ApiProperty({ type: () => MoneyDto }) amount!: MoneyDto;
}
export class PlanChargeDto extends PlanSourceDto {
  @ApiProperty({ type: String }) kind!: string;
  @ApiProperty({ type: String, enum: ['cost', 'provision', 'investment'] }) bucket!:
    'cost' | 'provision' | 'investment';
  @ApiProperty({ type: () => MoneyDto }) amount!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) originalAmount!: MoneyDto;
  @ApiProperty({ type: PlanDueDto, isArray: true }) duePayments!: PlanDueDto[];
  @ApiProperty({ type: String, nullable: true }) overrideReason!: string | null;
}
export class PlanAllocationInputDto {
  @ApiProperty({ type: String, maxLength: 80 }) id!: string;
  @ApiProperty({ type: () => DestinationDto }) destination!: DestinationDto;
  @ApiProperty({ type: String, enum: ['commitment', 'tax_reserve', 'everyday', 'remaining'] })
  purpose!: 'commitment' | 'tax_reserve' | 'everyday' | 'remaining';
  @ApiProperty({ type: String, nullable: true }) sourceLineId!: string | null;
  @ApiProperty({ type: () => MoneyInputDto }) amount!: MoneyInputDto;
  @ApiProperty({ type: Boolean }) remainder!: boolean;
}
export class PlanAllocationDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: () => PlanDestinationDto }) destination!: PlanDestinationDto;
  @ApiProperty({ type: String, enum: ['commitment', 'tax_reserve', 'everyday', 'remaining'] })
  purpose!: PlanAllocationInputDto['purpose'];
  @ApiProperty({ type: String, nullable: true }) sourceLineId!: string | null;
  @ApiProperty({ type: () => MoneyDto }) amount!: MoneyDto;
  @ApiProperty({ type: Boolean }) remainder!: boolean;
  @ApiProperty({ type: String }) label!: string;
}
export class PlanAllocationGroupDto {
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String }) accountName!: string;
  @ApiProperty({ type: () => MoneyDto }) directAmount!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) total!: MoneyDto;
  @ApiProperty({ type: PlanAllocationDto, isArray: true }) allocations!: PlanAllocationDto[];
}
export class PlanSummaryDto {
  @ApiProperty({ type: () => MoneyDto }) expectedCash!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) taxReserve!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) spendableIncome!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) monthlyCosts!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) annualProvisions!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) plannedInvestment!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) planningCharges!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) plannedAvailability!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) allocatedCash!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) unallocatedCash!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) everydayAllocation!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) remainingAvailability!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) fundingGap!: MoneyDto;
}
export class MonthlyPlanDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) month!: string;
  @ApiProperty({ type: Number }) revision!: number;
  @ApiProperty({ type: Number }) currentRevision!: number;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, enum: ['draft', 'closed'] }) state!: 'draft' | 'closed';
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) closedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) reopenReason!: string | null;
  @ApiProperty({ type: () => PlanSummaryDto }) summary!: PlanSummaryDto;
  @ApiProperty({ type: PlanIncomeDto, isArray: true }) incomes!: PlanIncomeDto[];
  @ApiProperty({ type: PlanChargeDto, isArray: true }) charges!: PlanChargeDto[];
  @ApiProperty({ type: PlanAllocationDto, isArray: true }) allocations!: PlanAllocationDto[];
  @ApiProperty({ type: PlanAllocationGroupDto, isArray: true }) groups!: PlanAllocationGroupDto[];
}
export class PlanAllocationsWriteDto extends PlanVersionDto {
  @ApiProperty({ type: PlanAllocationInputDto, isArray: true, maxItems: 500 })
  allocations!: PlanAllocationInputDto[];
}
export class PlanOverrideDto extends PlanReasonDto {
  @ApiProperty({ type: () => MoneyInputDto }) amount!: MoneyInputDto;
  @ApiProperty({ type: () => MoneyInputDto, nullable: true }) taxReserve!: MoneyInputDto | null;
}
export class PlanRefreshDto extends PlanVersionDto {
  @ApiProperty({ type: String }) inputFingerprint!: string;
  @ApiProperty({ type: String, isArray: true }) discardOverrideIds!: string[];
  @ApiProperty({ type: Boolean }) resetAllocations!: boolean;
}
export class OverrideConflictDto {
  @ApiProperty({ type: String }) lineId!: string;
  @ApiProperty({ type: String }) name!: string;
}
export class PlanRefreshPreviewDto extends PlanVersionDto {
  @ApiProperty({ type: String }) inputFingerprint!: string;
  @ApiProperty({ type: String, isArray: true }) added!: string[];
  @ApiProperty({ type: String, isArray: true }) removed!: string[];
  @ApiProperty({ type: String, isArray: true }) changed!: string[];
  @ApiProperty({ type: OverrideConflictDto, isArray: true })
  overrideConflicts!: OverrideConflictDto[];
  @ApiProperty({ type: String, isArray: true }) allocationConflicts!: string[];
}
export class PlanHistoryQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1 }) page?: number;
}
export class PlanHistoryItemDto {
  @ApiProperty({ type: Number }) revision!: number;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, enum: ['draft', 'closed'] }) state!: 'draft' | 'closed';
  @ApiProperty({ type: String }) createdAt!: string;
  @ApiProperty({ type: String, nullable: true }) closedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) reopenReason!: string | null;
  @ApiProperty({ type: () => MoneyDto }) availability!: MoneyDto;
}
export class PlanHistoryDto {
  @ApiProperty({ type: PlanHistoryItemDto, isArray: true }) items!: PlanHistoryItemDto[];
  @ApiProperty({ type: Number }) total!: number;
}
export class PlanTrendDto {
  @ApiProperty({ type: String }) month!: string;
  @ApiProperty({ type: String, enum: ['draft', 'closed'] }) state!: 'draft' | 'closed';
  @ApiProperty({ type: () => MoneyDto }) availability!: MoneyDto;
}
