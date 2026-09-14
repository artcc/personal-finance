import { ApiProperty } from '@nestjs/swagger';
import { MoneyDto, MoneyInputDto, PageDto } from '../../../shared/http/financial.dto.js';
import {
  DatedAmountDto,
  LinkedPlanDto,
  PlanningLinkInputDto,
} from '../../../shared/http/asset.dto.js';

export class InvestmentMetadataDto {
  @ApiProperty({ type: String, maxLength: 120 }) name!: string;
  @ApiProperty({ type: String, nullable: true }) platform!: string | null;
  @ApiProperty({ type: String, nullable: true }) ticker!: string | null;
  @ApiProperty({ type: String, enum: ['fund', 'pension', 'crypto', 'other'] }) kind!:
    'fund' | 'pension' | 'crypto' | 'other';
}
export class InvestmentCreateDto extends InvestmentMetadataDto {
  @ApiProperty({ type: String, enum: ['contributions', 'units'] }) mode!: 'contributions' | 'units';
  @ApiProperty({ type: () => PlanningLinkInputDto, nullable: true })
  planning!: PlanningLinkInputDto | null;
}
export class InvestmentUpdateDto extends InvestmentMetadataDto {
  @ApiProperty({ type: Number }) expectedVersion!: number;
  @ApiProperty({ type: () => PlanningLinkInputDto, nullable: true })
  planning!: PlanningLinkInputDto | null;
}
export class MovementSummaryDto {
  @ApiProperty({ type: String, nullable: true }) units!: string | null;
  @ApiProperty({ type: () => MoneyDto }) moneyIn!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) moneyOut!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) netCashFlow!: MoneyDto;
  @ApiProperty({ type: Boolean }) openingCapitalUnknown!: boolean;
  @ApiProperty({ type: String, nullable: true }) lastMovementDate!: string | null;
}
export class InvestmentDto extends InvestmentMetadataDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, enum: ['contributions', 'units'] }) mode!: 'contributions' | 'units';
  @ApiProperty({ type: () => LinkedPlanDto, nullable: true }) planning!: LinkedPlanDto | null;
  @ApiProperty({ type: () => MovementSummaryDto }) summary!: MovementSummaryDto;
  @ApiProperty({ type: () => DatedAmountDto, nullable: true })
  latestValuation!: DatedAmountDto | null;
  @ApiProperty({ type: Boolean }) valuationStale!: boolean;
}
export class InvestmentsPageDto extends PageDto {
  @ApiProperty({ type: InvestmentDto, isArray: true }) items!: InvestmentDto[];
}
export class MovementInputDto {
  @ApiProperty({ type: String, format: 'date' }) date!: string;
  @ApiProperty({ type: String, enum: ['opening', 'contribution', 'withdrawal', 'buy', 'sell'] })
  kind!: 'opening' | 'contribution' | 'withdrawal' | 'buy' | 'sell';
  @ApiProperty({ type: String, nullable: true }) quantity!: string | null;
  @ApiProperty({ type: () => MoneyInputDto, nullable: true }) amount!: MoneyInputDto | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 500 }) note!: string | null;
}
export class MovementWriteDto {
  @ApiProperty({ type: Number }) expectedVersion!: number;
  @ApiProperty({ type: () => MovementInputDto }) input!: MovementInputDto;
}
export class MovementCorrectionDto extends MovementWriteDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 500 }) reason!: string;
}
export class MovementDto extends MovementInputDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) sequence!: number;
  @ApiProperty({ type: Number }) orderSequence!: number;
  @ApiProperty({ type: String, nullable: true }) voidedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) voidReason!: string | null;
  @ApiProperty({ type: String, nullable: true }) replacesId!: string | null;
}
export class MovementsPageDto extends PageDto {
  @ApiProperty({ type: MovementDto, isArray: true }) items!: MovementDto[];
}
