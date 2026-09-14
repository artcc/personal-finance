import { ApiProperty } from '@nestjs/swagger';
import {
  DefinitionDto,
  MoneyDto,
  MoneyInputDto,
  PageDto,
} from '../../../shared/http/financial.dto.js';
import type { CommitmentDefinition } from '../domain/commitment.js';

export class InstallmentDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 12 }) month!: number;
  @ApiProperty({ type: Number, minimum: 1, maximum: 31 }) day!: number;
  @ApiProperty({ type: () => MoneyInputDto }) amount!: MoneyInputDto;
}
export class CommitmentDefinitionDto extends DefinitionDto implements CommitmentDefinition {
  @ApiProperty({
    type: String,
    enum: ['fixed', 'subscription', 'professional', 'shared', 'financing', 'investment'],
  })
  kind!: CommitmentDefinition['kind'];
  @ApiProperty({ type: String, enum: ['monthly', 'annual'] }) frequency!: 'monthly' | 'annual';
  @ApiProperty({ type: () => MoneyInputDto }) amount!: MoneyInputDto;
  @ApiProperty({ type: Number, nullable: true, minimum: 1, maximum: 31 }) dueDay!: number | null;
  @ApiProperty({ type: InstallmentDto, isArray: true, maxItems: 24 })
  installments!: InstallmentDto[];
}
export class CommitmentWriteDto {
  @ApiProperty({ type: () => CommitmentDefinitionDto }) input!: CommitmentDefinitionDto;
}
export class CommitmentRevisionWriteDto extends CommitmentWriteDto {
  @ApiProperty({ type: Number }) expectedVersion!: number;
}
export class CommitmentPreviewInputDto extends CommitmentWriteDto {
  @ApiProperty({ type: String }) month!: string;
}
export class DuePaymentDto {
  @ApiProperty({ type: String, format: 'date' }) date!: string;
  @ApiProperty({ type: () => MoneyDto }) amount!: MoneyDto;
}
export class CommitmentProjectionDto {
  @ApiProperty({ type: Boolean }) active!: boolean;
  @ApiProperty({ type: () => MoneyDto }) monthlyCharge!: MoneyDto;
  @ApiProperty({ type: DuePaymentDto, isArray: true }) duePayments!: DuePaymentDto[];
}
export class CommitmentRevisionDto extends CommitmentWriteDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}
export class CommitmentRecordDto {
  @ApiProperty({ type: String, enum: ['financing', 'investment'], nullable: true }) managedKind!:
    'financing' | 'investment' | null;
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, nullable: true }) archivedFromMonth!: string | null;
  @ApiProperty({ type: () => CommitmentRevisionDto }) revision!: CommitmentRevisionDto;
  @ApiProperty({ type: () => CommitmentProjectionDto }) projection!: CommitmentProjectionDto;
}
export class CommitmentsPageDto extends PageDto {
  @ApiProperty({ type: CommitmentRecordDto, isArray: true }) items!: CommitmentRecordDto[];
}
export class CommitmentDetailDto extends PageDto {
  @ApiProperty({ type: () => CommitmentRecordDto }) current!: CommitmentRecordDto;
  @ApiProperty({ type: CommitmentRevisionDto, isArray: true }) history!: CommitmentRevisionDto[];
}
