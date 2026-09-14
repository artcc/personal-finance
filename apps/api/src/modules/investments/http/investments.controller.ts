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
import { InvestmentsService } from '../application/investments.service.js';
import { CsrfHeader, FinancialApi, ListQueryDto } from '../../../shared/http/financial.dto.js';
import { ReportAmountDto, ReportsPageDto, AssetReasonDto } from '../../../shared/http/asset.dto.js';
import {
  assetReasonSchema,
  investmentCreateSchema,
  investmentMetadataSchema,
  planningLinkSchema,
  movementWriteSchema,
  movementCorrectionSchema,
  reportSchema,
} from '../../../shared/application/asset-input.js';
import {
  listSchema,
  parseFinancial,
  resourceId,
  versionSchema,
} from '../../../shared/application/financial-input.js';
import {
  InvestmentCreateDto,
  InvestmentDto,
  InvestmentUpdateDto,
  InvestmentsPageDto,
  MovementWriteDto,
  MovementCorrectionDto,
  MovementsPageDto,
} from './investments.dto.js';

@FinancialApi()
@ApiTags('investments')
@ApiExtraModels(ListQueryDto)
@Controller('investments')
export class InvestmentsController {
  constructor(@Inject(InvestmentsService) private readonly investments: InvestmentsService) {}
  @Get()
  @ApiOkResponse({ type: InvestmentsPageDto })
  list(
    @CurrentSession() session: SessionRecord,
    @Query() query: ListQueryDto,
  ): Promise<InvestmentsPageDto> {
    return this.investments.list(session.user.id, parseFinancial(listSchema, query));
  }
  @Get(':id')
  @ApiOkResponse({ type: InvestmentDto })
  detail(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
  ): Promise<InvestmentDto> {
    return this.investments.detail(session.user.id, resourceId(id));
  }
  @Post()
  @CsrfHeader()
  @ApiBody({ type: InvestmentCreateDto })
  @ApiCreatedResponse({ type: InvestmentDto })
  create(@CurrentSession() session: SessionRecord, @Body() body: unknown): Promise<InvestmentDto> {
    return this.investments.create(session.user.id, parseFinancial(investmentCreateSchema, body));
  }
  @Patch(':id')
  @CsrfHeader()
  @ApiBody({ type: InvestmentUpdateDto })
  @ApiOkResponse({ type: InvestmentDto })
  update(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<InvestmentDto> {
    const { expectedVersion, ...input } = parseFinancial(
      investmentMetadataSchema.extend({
        planning: planningLinkSchema.nullable(),
        expectedVersion: versionSchema,
      }),
      body,
    );
    return this.investments.update(session.user.id, resourceId(id), input, expectedVersion);
  }
  @Get(':id/entries')
  @ApiOkResponse({ type: MovementsPageDto })
  entries(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Query() query: ListQueryDto,
  ): Promise<MovementsPageDto> {
    return this.investments.entries(
      session.user.id,
      resourceId(id),
      parseFinancial(listSchema, query),
    );
  }
  @Post(':id/entries')
  @CsrfHeader()
  @ApiBody({ type: MovementWriteDto })
  @ApiCreatedResponse({ type: InvestmentDto })
  entry(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<InvestmentDto> {
    const input = parseFinancial(movementWriteSchema, body);
    return this.investments.writeEntry(
      session.user.id,
      resourceId(id),
      input.expectedVersion,
      input.input,
    );
  }
  @Post(':id/entries/:entryId/correct')
  @CsrfHeader()
  @ApiBody({ type: MovementCorrectionDto })
  @ApiCreatedResponse({ type: InvestmentDto })
  correct(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() body: unknown,
  ): Promise<InvestmentDto> {
    const input = parseFinancial(movementCorrectionSchema, body);
    return this.investments.writeEntry(
      session.user.id,
      resourceId(id),
      input.expectedVersion,
      input.input,
      resourceId(entryId),
      input.reason,
    );
  }
  @Post(':id/entries/:entryId/void')
  @CsrfHeader()
  @ApiBody({ type: AssetReasonDto })
  @ApiCreatedResponse({ type: InvestmentDto })
  void(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() body: unknown,
  ): Promise<InvestmentDto> {
    const input = parseFinancial(assetReasonSchema, body);
    return this.investments.voidEntry(
      session.user.id,
      resourceId(id),
      resourceId(entryId),
      input.expectedVersion,
      input.reason,
    );
  }
  @Post(':id/valuations')
  @CsrfHeader()
  @ApiBody({ type: ReportAmountDto })
  @ApiCreatedResponse({ type: InvestmentDto })
  value(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<InvestmentDto> {
    const input = parseFinancial(reportSchema, body);
    return this.investments.value(session.user.id, resourceId(id), input.expectedVersion, input);
  }
  @Get(':id/valuations')
  @ApiOkResponse({ type: ReportsPageDto })
  valuations(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Query() query: ListQueryDto,
  ): Promise<ReportsPageDto> {
    return this.investments.valuations(
      session.user.id,
      resourceId(id),
      parseFinancial(listSchema, query),
    );
  }
}
