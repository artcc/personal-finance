import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  IDENTITY_CLOCK,
  IDENTITY_STORE,
  PASSWORD_HASHER,
  TOKEN_CODEC,
} from './application/identity.ports.js';
import { IdentityService } from './application/identity.service.js';
import { PrismaIdentityStore } from './infrastructure/prisma-identity.store.js';
import { NodeTokenCodec, ScryptPasswordHasher } from './infrastructure/node-crypto.js';
import { AuthController } from './http/auth.controller.js';
import { AuthGuard } from './http/auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    IdentityService,
    { provide: IDENTITY_STORE, useClass: PrismaIdentityStore },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    { provide: TOKEN_CODEC, useClass: NodeTokenCodec },
    { provide: IDENTITY_CLOCK, useValue: () => new Date() },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [IdentityService],
})
export class IdentityModule {}
