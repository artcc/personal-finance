import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { FinancialClock } from '../application/financial-clock.js';
import { FinancialApi } from './financial.dto.js';

class FinancialContextDto {
  @ApiProperty({ type: String }) month!: string;
  @ApiProperty({ type: String, format: 'date' }) today!: string;
  @ApiProperty({ type: String, enum: ['EUR'] }) currency!: 'EUR';
}
@FinancialApi()
@ApiTags('financial-context')
@Controller('financial-context')
export class FinancialContextController {
  constructor(@Inject(FinancialClock) private readonly clock: FinancialClock) {}
  @Get()
  @ApiOkResponse({ type: FinancialContextDto })
  context(): FinancialContextDto {
    return this.clock.context();
  }
}
