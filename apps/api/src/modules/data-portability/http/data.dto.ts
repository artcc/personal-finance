import { ApiProperty } from '@nestjs/swagger';
export class ImportPreviewDto {
  @ApiProperty({ type: Number }) formatVersion!: number;
  @ApiProperty({ type: String, format: 'date-time' }) exportedAt!: string;
  @ApiProperty({ type: String }) fingerprint!: string;
  @ApiProperty({ type: Object, additionalProperties: { type: 'integer' } }) counts!: Record<
    string,
    number
  >;
  @ApiProperty({ type: Number }) totalRecords!: number;
  @ApiProperty({ type: Boolean }) canImport!: boolean;
}
export class ImportRequestDto {
  @ApiProperty({ type: Object, additionalProperties: true }) document!: Record<string, unknown>;
  @ApiProperty({ type: String }) fingerprint!: string;
}
export class ImportResultDto {
  @ApiProperty({ type: Object, additionalProperties: { type: 'integer' } }) counts!: Record<
    string,
    number
  >;
  @ApiProperty({ type: Number }) totalRecords!: number;
}
