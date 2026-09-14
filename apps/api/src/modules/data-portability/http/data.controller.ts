import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { RouteConfig } from '@nestjs/platform-fastify';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { CurrentSession } from '../../identity/http/access.js';
import type { SessionRecord } from '../../identity/application/identity.ports.js';
import { CsrfHeader, FinancialApi } from '../../../shared/http/financial.dto.js';
import { DataService } from '../application/data.service.js';
import { DataFileError, MAX_DOCUMENT_BYTES, exportText } from '../application/document.js';
import { ImportPreviewDto, ImportRequestDto, ImportResultDto } from './data.dto.js';

@FinancialApi()
@ApiTags('data-portability')
@Controller('data')
export class DataController {
  constructor(@Inject(DataService) private readonly data: DataService) {}
  @Get('export')
  @ApiProduces('application/json')
  @ApiOkResponse({
    content: { 'application/json': { schema: { type: 'string', format: 'binary' } } },
  })
  async export(
    @CurrentSession() session: SessionRecord,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const document = await this.data.export(session.user.id);
    const text = exportText(document);
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header(
      'Content-Disposition',
      `attachment; filename="personal-finance-${document.exportedAt.slice(0, 10)}.json"`,
    );
    void reply.type('application/json; charset=utf-8').send(text);
  }
  @Post('import-preview')
  @HttpCode(200)
  @RouteConfig({ bodyLimit: MAX_DOCUMENT_BYTES + 4096 })
  @CsrfHeader()
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      description:
        'A complete version-1 financial JSON export. All models and relationships are validated by the file schema.',
    },
  })
  @ApiOkResponse({ type: ImportPreviewDto })
  preview(
    @CurrentSession() session: SessionRecord,
    @Body() body: unknown,
  ): Promise<ImportPreviewDto> {
    return this.data.preview(session.user.id, body);
  }
  @Post('import')
  @HttpCode(200)
  @RouteConfig({ bodyLimit: MAX_DOCUMENT_BYTES + 4096 })
  @CsrfHeader()
  @ApiBody({ type: ImportRequestDto })
  @ApiOkResponse({ type: ImportResultDto })
  import(
    @CurrentSession() session: SessionRecord,
    @Body() body: unknown,
  ): Promise<ImportResultDto> {
    const input = z
      .object({
        document: z.record(z.string(), z.unknown()),
        fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict()
      .safeParse(body);
    if (!input.success) throw new DataFileError('INVALID_DATA_FILE');
    return this.data.import(session.user.id, input.data.document, input.data.fingerprint);
  }
}
