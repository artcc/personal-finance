import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  ApiConflictResponse,
  ApiOperation,
  ApiHeader,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ENVIRONMENT } from '../../../shared/environment.js';
import type { Environment } from '../../../shared/environment.js';
import { HttpErrorDto } from '../../../shared/http-error.dto.js';
import { IdentityService } from '../application/identity.service.js';
import type { SessionRecord } from '../application/identity.ports.js';
import { CurrentSession, Public } from './access.js';
import { ActiveSessionDto, CurrentSessionDto, LoginDto, RegisterDto } from './auth.dto.js';
import { loginSchema, parseAuthInput, registerSchema } from './auth.validation.js';
import { clearSessionCookie, writeSessionCookie } from './session-cookie.js';

function currentSessionDto(session: SessionRecord): CurrentSessionDto {
  return {
    user: { id: session.user.id, email: session.user.email, displayName: session.user.displayName },
    sessionId: session.id,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt.toISOString(),
    idleExpiresAt: session.idleExpiresAt.toISOString(),
  };
}

@ApiTags('identity')
@ApiCookieAuth('session')
@ApiUnauthorizedResponse({ type: HttpErrorDto })
@ApiForbiddenResponse({ type: HttpErrorDto })
@ApiTooManyRequestsResponse({ type: HttpErrorDto })
@ApiUnprocessableEntityResponse({ type: HttpErrorDto })
@ApiBadRequestResponse({ type: HttpErrorDto })
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ operationId: 'registerAccount', security: [] })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ type: CurrentSessionDto })
  @ApiConflictResponse({ type: HttpErrorDto })
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<CurrentSessionDto> {
    const result = await this.identity.register(parseAuthInput(registerSchema, body));
    writeSessionCookie(reply, this.environment, result.token, result.session.expiresAt);
    return currentSessionDto(result.session);
  }

  @Public()
  @Post('login')
  @ApiOperation({ operationId: 'login', security: [] })
  @HttpCode(200)
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: CurrentSessionDto })
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<CurrentSessionDto> {
    const input = parseAuthInput(loginSchema, body);
    const result = await this.identity.login(input.email, input.password);
    writeSessionCookie(reply, this.environment, result.token, result.session.expiresAt);
    return currentSessionDto(result.session);
  }

  @Get('session')
  @ApiOkResponse({ type: CurrentSessionDto })
  session(@CurrentSession() session: SessionRecord): CurrentSessionDto {
    return currentSessionDto(session);
  }

  @Get('sessions')
  @ApiOkResponse({ type: ActiveSessionDto, isArray: true })
  async sessions(@CurrentSession() current: SessionRecord): Promise<ActiveSessionDto[]> {
    return (await this.identity.listSessions(current)).map((session) => ({
      id: session.id,
      current: session.id === current.id,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }));
  }

  @Delete('sessions/:id')
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: HttpErrorDto })
  async revoke(
    @CurrentSession() current: SessionRecord,
    @Param('id') id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.identity.revokeSession(current, parseAuthInput(z.uuid(), id));
    if (id === current.id) clearSessionCookie(reply, this.environment);
  }

  @Post('logout')
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiBody({ schema: { type: 'object', additionalProperties: false } })
  @HttpCode(204)
  @ApiNoContentResponse()
  async logout(
    @CurrentSession() session: SessionRecord,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.identity.revokeSession(session, session.id);
    clearSessionCookie(reply, this.environment);
  }

  @Post('logout-all')
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiBody({ schema: { type: 'object', additionalProperties: false } })
  @HttpCode(204)
  @ApiNoContentResponse()
  async logoutAll(
    @CurrentSession() session: SessionRecord,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.identity.logoutAll(session);
    clearSessionCookie(reply, this.environment);
  }
}
