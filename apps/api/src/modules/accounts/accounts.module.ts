import { Module } from '@nestjs/common';
import { AccountsController } from './http/accounts.controller.js';
import { AccountsService } from './application/accounts.service.js';
import { ACCOUNTS_STORE } from './application/accounts.port.js';
import { PrismaAccountsStore } from './infrastructure/prisma-accounts.store.js';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, { provide: ACCOUNTS_STORE, useClass: PrismaAccountsStore }],
})
export class AccountsModule {}
