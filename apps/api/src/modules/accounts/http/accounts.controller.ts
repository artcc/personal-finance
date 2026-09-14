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
import { AccountsService } from '../application/accounts.service.js';
import {
  accountInputSchema,
  archiveSchema,
  listSchema,
  parseFinancial,
  resourceId,
  versionSchema,
} from '../../../shared/application/financial-input.js';
import { CsrfHeader, FinancialApi, ListQueryDto } from '../../../shared/http/financial.dto.js';
import {
  AccountArchiveDto,
  AccountDto,
  AccountInputDto,
  AccountUpdateDto,
  AccountsPageDto,
  ArchiveMonthDto,
  ArchivePreviewDto,
  SpaceDto,
  SpaceInputDto,
  SpacesPageDto,
  SpaceUpdateDto,
} from './accounts.dto.js';

@FinancialApi()
@ApiExtraModels(ListQueryDto)
@ApiTags('accounts')
@Controller()
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accounts: AccountsService) {}
  @Get('accounts')
  @ApiOkResponse({ type: AccountsPageDto })
  list(
    @CurrentSession() session: SessionRecord,
    @Query() query: ListQueryDto,
  ): Promise<AccountsPageDto> {
    return this.accounts.list(session.user.id, parseFinancial(listSchema, query));
  }
  @Post('accounts')
  @CsrfHeader()
  @ApiBody({ type: AccountInputDto })
  @ApiCreatedResponse({ type: AccountDto })
  create(@CurrentSession() session: SessionRecord, @Body() body: unknown): Promise<AccountDto> {
    return this.accounts.create(session.user.id, parseFinancial(accountInputSchema, body));
  }
  @Patch('accounts/:id')
  @CsrfHeader()
  @ApiBody({ type: AccountUpdateDto })
  @ApiOkResponse({ type: AccountDto })
  update(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<AccountDto> {
    const { expectedVersion, ...input } = parseFinancial(
      accountInputSchema.extend({ expectedVersion: versionSchema }),
      body,
    );
    return this.accounts.update(session.user.id, resourceId(id), input, expectedVersion);
  }
  @Get('accounts/:id/spaces')
  @ApiOkResponse({ type: SpacesPageDto })
  spaces(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Query() query: ListQueryDto,
  ): Promise<SpacesPageDto> {
    return this.accounts.spaces(session.user.id, resourceId(id), parseFinancial(listSchema, query));
  }
  @Post('accounts/:id/spaces')
  @CsrfHeader()
  @ApiBody({ type: SpaceInputDto })
  @ApiCreatedResponse({ type: SpaceDto })
  createSpace(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SpaceDto> {
    const input = parseFinancial(
      z.object({ name: z.string().trim().min(1).max(120) }).strict(),
      body,
    );
    return this.accounts.createSpace(session.user.id, resourceId(id), input.name);
  }
  @Patch('spaces/:id')
  @CsrfHeader()
  @ApiBody({ type: SpaceUpdateDto })
  @ApiOkResponse({ type: SpaceDto })
  updateSpace(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SpaceDto> {
    const input = parseFinancial(
      z
        .object({ name: z.string().trim().min(1).max(120), expectedVersion: versionSchema })
        .strict(),
      body,
    );
    return this.accounts.updateSpace(
      session.user.id,
      resourceId(id),
      input.name,
      input.expectedVersion,
    );
  }
  @Post('accounts/:id/archive-preview')
  @HttpCode(200)
  @CsrfHeader()
  @ApiBody({ type: ArchiveMonthDto })
  @ApiOkResponse({ type: ArchivePreviewDto })
  async previewAccount(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<ArchivePreviewDto> {
    return this.preview(session, id, body, false);
  }
  @Post('spaces/:id/archive-preview')
  @HttpCode(200)
  @CsrfHeader()
  @ApiBody({ type: ArchiveMonthDto })
  @ApiOkResponse({ type: ArchivePreviewDto })
  async previewSpace(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<ArchivePreviewDto> {
    return this.preview(session, id, body, true);
  }
  private async preview(
    session: SessionRecord,
    id: string,
    body: unknown,
    space: boolean,
  ): Promise<ArchivePreviewDto> {
    const input = parseFinancial(
      z.object({ archivedFromMonth: z.string().length(7) }).strict(),
      body,
    );
    const preview = await this.accounts.preview(
      session.user.id,
      resourceId(id),
      input.archivedFromMonth,
      space,
    );
    return { ...preview, spaceIds: preview.spaces.map((item) => item.id) };
  }
  @Post('accounts/:id/archive')
  @HttpCode(204)
  @CsrfHeader()
  @ApiBody({ type: AccountArchiveDto })
  @ApiNoContentResponse()
  archiveAccount(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    return this.accounts.archive(
      session.user.id,
      resourceId(id),
      parseFinancial(archiveSchema, body),
      false,
    );
  }
  @Post('spaces/:id/archive')
  @HttpCode(204)
  @CsrfHeader()
  @ApiBody({ type: AccountArchiveDto })
  @ApiNoContentResponse()
  archiveSpace(
    @CurrentSession() session: SessionRecord,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    return this.accounts.archive(
      session.user.id,
      resourceId(id),
      parseFinancial(archiveSchema, body),
      true,
    );
  }
}
