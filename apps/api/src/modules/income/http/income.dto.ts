import { ApiProperty } from '@nestjs/swagger';
import {
  DefinitionDto,
  MoneyDto,
  MoneyInputDto,
  PageDto,
} from '../../../shared/http/financial.dto.js';
import type { IncomeDefinition } from '../domain/income.js';

export class IncomeDefinitionDto extends DefinitionDto implements IncomeDefinition {
  @ApiProperty({ type: String, enum: ['salary', 'professional'] }) kind!: 'salary' | 'professional';
  @ApiProperty({ type: () => MoneyInputDto, nullable: true }) netSalary!: MoneyInputDto | null;
  @ApiProperty({ type: () => MoneyInputDto, nullable: true }) base!: MoneyInputDto | null;
  @ApiProperty({ type: String, nullable: true }) hourlyRate!: string | null;
  @ApiProperty({ type: String, nullable: true }) hours!: string | null;
  @ApiProperty({ type: String }) vatRate!: string;
  @ApiProperty({ type: String }) withholdingRate!: string;
  @ApiProperty({ type: String }) commissionRate!: string;
}
export class IncomeWriteDto {
  @ApiProperty({ type: () => IncomeDefinitionDto }) input!: IncomeDefinitionDto;
}
export class IncomeRevisionWriteDto extends IncomeWriteDto {
  @ApiProperty({ type: Number }) expectedVersion!: number;
}
export class IncomeCalculationDto {
  @ApiProperty({ type: () => MoneyDto }) base!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) vat!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) withholding!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) commission!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) expectedCash!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) taxReserve!: MoneyDto;
  @ApiProperty({ type: () => MoneyDto }) spendableIncome!: MoneyDto;
}
export class IncomeRevisionDto extends IncomeWriteDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: () => IncomeCalculationDto }) calculation!: IncomeCalculationDto;
}
export class IncomeRecordDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, nullable: true }) archivedFromMonth!: string | null;
  @ApiProperty({ type: String, enum: ['monthly', 'once'] }) recurrence!: 'monthly' | 'once';
  @ApiProperty({ type: String, nullable: true }) oneOffMonth!: string | null;
  @ApiProperty({ type: () => IncomeRevisionDto }) revision!: IncomeRevisionDto;
  @ApiProperty({ type: Boolean }) active!: boolean;
  @ApiProperty({ type: () => IncomeCalculationDto }) calculation!: IncomeCalculationDto;
}
export class IncomePageDto extends PageDto {
  @ApiProperty({ type: IncomeRecordDto, isArray: true }) items!: IncomeRecordDto[];
}
export class IncomeDetailDto extends PageDto {
  @ApiProperty({ type: () => IncomeRecordDto }) current!: IncomeRecordDto;
  @ApiProperty({ type: IncomeRevisionDto, isArray: true }) history!: IncomeRevisionDto[];
}
