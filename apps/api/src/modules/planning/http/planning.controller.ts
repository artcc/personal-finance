import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiExtraModels, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RouteConfig } from '@nestjs/platform-fastify';
import { z } from 'zod';
import { CurrentSession } from '../../identity/http/access.js';
import type { SessionRecord } from '../../identity/application/identity.ports.js';
import { CsrfHeader, FinancialApi } from '../../../shared/http/financial.dto.js';
import { resourceId } from '../../../shared/application/financial-input.js';
import { PlanningService } from '../application/planning.service.js';
import {
  allocationsInput,
  closeInput,
  overrideInput,
  parsePlan,
  reasonInput,
  refreshInput,
  versionInput,
} from '../application/planning.schemas.js';
import {
  MonthlyPlanDto,
  PlanAllocationsWriteDto,
  PlanCloseDto,
  PlanHistoryDto,
  PlanHistoryQueryDto,
  PlanOverrideDto,
  PlanReasonDto,
  PlanRefreshDto,
  PlanRefreshPreviewDto,
  PlanTrendDto,
  PlanningMonthDto,
  PlanVersionDto,
} from './planning.dto.js';

const monthInput = z.object({ month: z.string().length(7) }).strict();
@FinancialApi()
@ApiTags('planning')
@ApiExtraModels(PlanningMonthDto, PlanHistoryQueryDto)
@Controller('monthly-plans')
export class PlanningController {
  constructor(@Inject(PlanningService) private readonly planning: PlanningService) {}
  @Get()
  @ApiOkResponse({ type: MonthlyPlanDto })
  get(
    @CurrentSession() session: SessionRecord,
    @Query() query: PlanningMonthDto,
  ): Promise<MonthlyPlanDto> {
    return this.planning.get(session.user.id, parsePlan(monthInput, query).month);
  }
  @Post()
  @HttpCode(200)
  @CsrfHeader()
  @ApiBody({ type: PlanningMonthDto })
  @ApiOkResponse({ type: MonthlyPlanDto })
  generate(
    @CurrentSession() session: SessionRecord,
    @Body() body: unknown,
  ): Promise<MonthlyPlanDto> {
    return this.planning.generate(session.user.id, parsePlan(monthInput, body).month);
  }
  @Get('trend')
  @ApiOkResponse({ type: PlanTrendDto, isArray: true })
  trend(
    @CurrentSession() session: SessionRecord,
    @Query() query: PlanningMonthDto,
  ): Promise<PlanTrendDto[]> {
    return this.planning.trend(session.user.id, parsePlan(monthInput, query).month);
  }
  @Get(':id/revisions')
  @ApiOkResponse({ type: PlanHistoryDto })
  history(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Query() query: PlanHistoryQueryDto,
  ): Promise<PlanHistoryDto> {
    const input = parsePlan(
      z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict(),
      query,
    );
    return this.planning.history(session.user.id, resourceId(id), input.page);
  }
  @Get(':id/revisions/:revision')
  @ApiOkResponse({ type: MonthlyPlanDto })
  revision(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Param('revision') revision: string,
  ): Promise<MonthlyPlanDto> {
    return this.planning.revision(
      session.user.id,
      resourceId(id),
      parsePlan(z.coerce.number().int().min(1), revision),
    );
  }
  @Put(':id/overrides/:lineId')
  @CsrfHeader()
  @ApiBody({ type: PlanOverrideDto })
  @ApiOkResponse({ type: MonthlyPlanDto })
  override(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: unknown,
  ): Promise<MonthlyPlanDto> {
    return this.planning.override(
      session.user.id,
      resourceId(id),
      lineId,
      parsePlan(overrideInput, body),
    );
  }
  @Delete(':id/overrides/:lineId')
  @CsrfHeader()
  @ApiBody({ type: PlanReasonDto })
  @ApiOkResponse({ type: MonthlyPlanDto })
  restore(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: unknown,
  ): Promise<MonthlyPlanDto> {
    return this.planning.restore(
      session.user.id,
      resourceId(id),
      lineId,
      parsePlan(reasonInput, body),
    );
  }
  @Put(':id/allocations')
  @RouteConfig({ bodyLimit: 512 * 1024 })
  @CsrfHeader()
  @ApiBody({ type: PlanAllocationsWriteDto })
  @ApiOkResponse({ type: MonthlyPlanDto })
  allocations(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<MonthlyPlanDto> {
    return this.planning.allocations(
      session.user.id,
      resourceId(id),
      parsePlan(allocationsInput, body),
    );
  }
  @Post(':id/allocations/suggest')
  @HttpCode(200)
  @CsrfHeader()
  @ApiBody({ type: PlanVersionDto })
  @ApiOkResponse({ type: MonthlyPlanDto })
  suggest(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<MonthlyPlanDto> {
    return this.planning.suggest(
      session.user.id,
      resourceId(id),
      parsePlan(versionInput, body).expectedVersion,
    );
  }
  @Post(':id/refresh-preview')
  @HttpCode(200)
  @CsrfHeader()
  @ApiBody({ type: PlanVersionDto })
  @ApiOkResponse({ type: PlanRefreshPreviewDto })
  preview(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<PlanRefreshPreviewDto> {
    return this.planning.refreshPreview(
      session.user.id,
      resourceId(id),
      parsePlan(versionInput, body).expectedVersion,
    );
  }
  @Post(':id/refresh')
  @HttpCode(200)
  @CsrfHeader()
  @ApiBody({ type: PlanRefreshDto })
  @ApiOkResponse({ type: MonthlyPlanDto })
  refresh(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<MonthlyPlanDto> {
    return this.planning.refresh(session.user.id, resourceId(id), parsePlan(refreshInput, body));
  }
  @Post(':id/close')
  @HttpCode(200)
  @CsrfHeader()
  @ApiBody({ type: PlanCloseDto })
  @ApiOkResponse({ type: MonthlyPlanDto })
  close(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<MonthlyPlanDto> {
    const input = parsePlan(closeInput, body);
    return this.planning.close(
      session.user.id,
      resourceId(id),
      input.expectedVersion,
      input.acknowledgeShortfall,
    );
  }
  @Post(':id/reopen')
  @HttpCode(200)
  @CsrfHeader()
  @ApiBody({ type: PlanReasonDto })
  @ApiOkResponse({ type: MonthlyPlanDto })
  reopen(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<MonthlyPlanDto> {
    const input = parsePlan(reasonInput, body);
    return this.planning.reopen(
      session.user.id,
      resourceId(id),
      input.expectedVersion,
      input.reason,
    );
  }
}
