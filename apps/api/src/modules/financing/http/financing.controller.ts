import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentSession } from '../../identity/http/access.js';
import type { SessionRecord } from '../../identity/application/identity.ports.js';
import { FinancingService } from '../application/financing.service.js';
import { CsrfHeader, FinancialApi, ListQueryDto } from '../../../shared/http/financial.dto.js';
import { ReportAmountDto, ReportsPageDto } from '../../../shared/http/asset.dto.js';
import {
  financingCreateSchema,
  financingMetadataSchema,
  reportSchema,
} from '../../../shared/application/asset-input.js';
import {
  listSchema,
  parseFinancial,
  resourceId,
  versionSchema,
} from '../../../shared/application/financial-input.js';
import {
  FinancingCreateDto,
  FinancingDto,
  FinancingUpdateDto,
  FinancingsPageDto,
} from './financing.dto.js';

@FinancialApi()
@ApiTags('financing')
@ApiExtraModels(ListQueryDto)
@Controller('financings')
export class FinancingController {
  constructor(@Inject(FinancingService) private readonly financing: FinancingService) {}
  @Get(':id')
  @ApiOkResponse({ type: FinancingDto })
  detail(@CurrentSession() session: SessionRecord, @Param('id') id: string): Promise<FinancingDto> {
    return this.financing.detail(session.user.id, resourceId(id));
  }
  @Get()
  @ApiOkResponse({ type: FinancingsPageDto })
  list(
    @CurrentSession() session: SessionRecord,
    @Query() query: ListQueryDto,
  ): Promise<FinancingsPageDto> {
    return this.financing.list(session.user.id, parseFinancial(listSchema, query));
  }
  @Post()
  @CsrfHeader()
  @ApiBody({ type: FinancingCreateDto })
  @ApiCreatedResponse({ type: FinancingDto })
  create(@CurrentSession() session: SessionRecord, @Body() body: unknown): Promise<FinancingDto> {
    return this.financing.create(session.user.id, parseFinancial(financingCreateSchema, body));
  }
  @Patch(':id')
  @CsrfHeader()
  @ApiBody({ type: FinancingUpdateDto })
  @ApiOkResponse({ type: FinancingDto })
  update(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<FinancingDto> {
    const { expectedVersion, ...input } = parseFinancial(
      financingMetadataSchema.extend({ expectedVersion: versionSchema }),
      body,
    );
    return this.financing.update(session.user.id, resourceId(id), input, expectedVersion);
  }
  @Post(':id/balances')
  @CsrfHeader()
  @ApiBody({ type: ReportAmountDto })
  @ApiCreatedResponse({ type: FinancingDto })
  report(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<FinancingDto> {
    return this.financing.report(
      session.user.id,
      resourceId(id),
      parseFinancial(reportSchema, body),
    );
  }
  @Get(':id/balances')
  @ApiOkResponse({ type: ReportsPageDto })
  reports(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Query() query: ListQueryDto,
  ): Promise<ReportsPageDto> {
    return this.financing.reports(
      session.user.id,
      resourceId(id),
      parseFinancial(listSchema, query),
    );
  }
}
