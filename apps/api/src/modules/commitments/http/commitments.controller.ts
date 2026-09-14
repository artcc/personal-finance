import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
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
import { CommitmentsService } from '../application/commitments.service.js';
import {
  commitmentDefinitionSchema,
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
  CommitmentDetailDto,
  CommitmentPreviewInputDto,
  CommitmentProjectionDto,
  CommitmentRecordDto,
  CommitmentRevisionWriteDto,
  CommitmentsPageDto,
  CommitmentWriteDto,
} from './commitments.dto.js';

const writeSchema = z.object({ input: commitmentDefinitionSchema }).strict();
@FinancialApi()
@ApiExtraModels(ListQueryDto, SourceListQueryDto)
@ApiTags('commitments')
@Controller('commitments')
export class CommitmentsController {
  constructor(@Inject(CommitmentsService) private readonly commitments: CommitmentsService) {}
  @Get()
  @ApiOkResponse({ type: CommitmentsPageDto })
  list(
    @CurrentSession() session: SessionRecord,
    @Query() query: SourceListQueryDto,
  ): Promise<CommitmentsPageDto> {
    return this.commitments.list(session.user.id, parseFinancial(sourceListSchema, query));
  }
  @Get(':id')
  @ApiOkResponse({ type: CommitmentDetailDto })
  detail(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Query() query: ListQueryDto,
  ): Promise<CommitmentDetailDto> {
    return this.commitments.detail(
      session.user.id,
      resourceId(id),
      parseFinancial(listSchema, query),
    );
  }
  @Post()
  @CsrfHeader()
  @ApiBody({ type: CommitmentWriteDto })
  @ApiCreatedResponse({ type: CommitmentRecordDto })
  create(
    @CurrentSession() session: SessionRecord,
    @Body() body: unknown,
  ): Promise<CommitmentRecordDto> {
    return this.commitments.create(session.user.id, parseFinancial(writeSchema, body).input);
  }
  @Post(':id/revisions')
  @CsrfHeader()
  @ApiBody({ type: CommitmentRevisionWriteDto })
  @ApiCreatedResponse({ type: CommitmentRecordDto })
  revise(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<CommitmentRecordDto> {
    const input = parseFinancial(writeSchema.extend({ expectedVersion: versionSchema }), body);
    return this.commitments.revise(
      session.user.id,
      resourceId(id),
      input.input,
      input.expectedVersion,
    );
  }
  @Post(':id/archive')
  @HttpCode(204)
  @CsrfHeader()
  @ApiBody({ type: SourceArchiveDto })
  @ApiNoContentResponse()
  archive(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    return this.commitments.archive(
      session.user.id,
      resourceId(id),
      parseFinancial(sourceArchiveSchema, body),
    );
  }
  @Post('preview')
  @HttpCode(200)
  @CsrfHeader()
  @ApiBody({ type: CommitmentPreviewInputDto })
  @ApiOkResponse({ type: CommitmentProjectionDto })
  preview(@Body() body: unknown): CommitmentProjectionDto {
    const input = parseFinancial(writeSchema.extend({ month: z.string().length(7) }), body);
    return this.commitments.preview(input.input, input.month);
  }
}
