import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiExtraModels,
} from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentSession } from '../../identity/http/access.js';
import type { SessionRecord } from '../../identity/application/identity.ports.js';
import { IncomeService } from '../application/income.service.js';
import {
  incomeDefinitionSchema,
  listSchema,
  sourceListSchema,
  parseFinancial,
  resourceId,
  sourceArchiveSchema,
  versionSchema,
} from '../../../shared/application/financial-input.js';
import {
  CsrfHeader,
  FinancialApi,
  ListQueryDto,
  SourceListQueryDto,
  SourceArchiveDto,
} from '../../../shared/http/financial.dto.js';
import {
  IncomeCalculationDto,
  IncomeDetailDto,
  IncomePageDto,
  IncomeRecordDto,
  IncomeRevisionWriteDto,
  IncomeWriteDto,
} from './income.dto.js';

const writeSchema = z.object({ input: incomeDefinitionSchema }).strict();
const reviseSchema = writeSchema.extend({ expectedVersion: versionSchema });
@FinancialApi()
@ApiExtraModels(ListQueryDto, SourceListQueryDto)
@ApiTags('income')
@Controller()
export class IncomeController {
  constructor(@Inject(IncomeService) private readonly income: IncomeService) {}
  @Get('income-sources')
  @ApiOkResponse({ type: IncomePageDto })
  list(
    @CurrentSession() session: SessionRecord,
    @Query() query: SourceListQueryDto,
  ): Promise<IncomePageDto> {
    return this.income.list(session.user.id, parseFinancial(sourceListSchema, query), 'monthly');
  }
  @Get('income-entries')
  @ApiOkResponse({ type: IncomePageDto })
  entries(
    @CurrentSession() session: SessionRecord,
    @Query() query: SourceListQueryDto,
  ): Promise<IncomePageDto> {
    return this.income.list(session.user.id, parseFinancial(sourceListSchema, query), 'once');
  }
  @Get('income-sources/:id')
  @ApiOkResponse({ type: IncomeDetailDto })
  detail(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Query() query: ListQueryDto,
  ): Promise<IncomeDetailDto> {
    return this.income.detail(session.user.id, resourceId(id), parseFinancial(listSchema, query));
  }
  @Post('income-sources')
  @CsrfHeader()
  @ApiBody({ type: IncomeWriteDto })
  @ApiCreatedResponse({ type: IncomeRecordDto })
  create(
    @CurrentSession() session: SessionRecord,
    @Body() body: unknown,
  ): Promise<IncomeRecordDto> {
    return this.income.create(session.user.id, parseFinancial(writeSchema, body).input, 'monthly');
  }
  @Post('income-entries')
  @CsrfHeader()
  @ApiBody({ type: IncomeWriteDto })
  @ApiCreatedResponse({ type: IncomeRecordDto })
  createEntry(
    @CurrentSession() session: SessionRecord,
    @Body() body: unknown,
  ): Promise<IncomeRecordDto> {
    return this.income.create(session.user.id, parseFinancial(writeSchema, body).input, 'once');
  }
  @Post('income-sources/:id/revisions')
  @CsrfHeader()
  @ApiBody({ type: IncomeRevisionWriteDto })
  @ApiCreatedResponse({ type: IncomeRecordDto })
  revise(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<IncomeRecordDto> {
    const input = parseFinancial(reviseSchema, body);
    return this.income.revise(
      session.user.id,
      resourceId(id),
      input.input,
      input.expectedVersion,
      'monthly',
    );
  }
  @Patch('income-entries/:id')
  @CsrfHeader()
  @ApiBody({ type: IncomeRevisionWriteDto })
  @ApiOkResponse({ type: IncomeRecordDto })
  reviseEntry(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<IncomeRecordDto> {
    const input = parseFinancial(reviseSchema, body);
    return this.income.revise(
      session.user.id,
      resourceId(id),
      input.input,
      input.expectedVersion,
      'once',
    );
  }
  @Post('income-sources/:id/archive')
  @HttpCode(204)
  @CsrfHeader()
  @ApiBody({ type: SourceArchiveDto })
  @ApiNoContentResponse()
  archive(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    return this.income.archive(
      session.user.id,
      resourceId(id),
      parseFinancial(sourceArchiveSchema, body),
    );
  }
  @Post('income/preview')
  @HttpCode(200)
  @CsrfHeader()
  @ApiBody({ type: IncomeWriteDto })
  @ApiOkResponse({ type: IncomeCalculationDto })
  preview(@Body() body: unknown): IncomeCalculationDto {
    return this.income.preview(parseFinancial(writeSchema, body).input);
  }
}
