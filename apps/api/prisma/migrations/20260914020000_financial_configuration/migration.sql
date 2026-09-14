CREATE TABLE "accounts" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" VARCHAR(120) NOT NULL, "institution" VARCHAR(120), "reference" VARCHAR(120),
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR' CHECK ("currency" = 'EUR'),
  "archived_from_month" CHAR(7), "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  UNIQUE ("id", "user_id")
);
CREATE INDEX "accounts_user_id_name_id_idx" ON "accounts"("user_id", "name", "id");
CREATE TABLE "spaces" (
  "id" UUID PRIMARY KEY, "account_id" UUID NOT NULL, "user_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL, "archived_from_month" CHAR(7), "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  UNIQUE ("id", "account_id", "user_id"),
  FOREIGN KEY ("account_id", "user_id") REFERENCES "accounts"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "spaces_user_id_account_id_name_id_idx" ON "spaces"("user_id", "account_id", "name", "id");
CREATE TABLE "income_sources" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "recurrence" VARCHAR(12) NOT NULL CHECK ("recurrence" IN ('monthly', 'once')),
  "one_off_month" CHAR(7), "archived_from_month" CHAR(7), "version" INTEGER NOT NULL DEFAULT 1,
  UNIQUE ("id", "user_id"), CHECK (("recurrence" = 'once') = ("one_off_month" IS NOT NULL))
);
CREATE INDEX "income_sources_user_id_recurrence_id_idx" ON "income_sources"("user_id", "recurrence", "id");
CREATE TABLE "income_revisions" (
  "id" UUID PRIMARY KEY, "source_id" UUID NOT NULL, "user_id" UUID NOT NULL, "version" INTEGER NOT NULL,
  "name" VARCHAR(120) NOT NULL, "effective_from_month" CHAR(7) NOT NULL, "starts_on" DATE NOT NULL, "ends_on" DATE,
  "account_id" UUID NOT NULL, "space_id" UUID, "input" JSONB NOT NULL,
  "base_cents" BIGINT NOT NULL, "vat_cents" BIGINT NOT NULL, "withholding_cents" BIGINT NOT NULL, "commission_cents" BIGINT NOT NULL,
  "cash_cents" BIGINT NOT NULL, "reserve_cents" BIGINT NOT NULL, "spendable_cents" BIGINT NOT NULL,
  "vat_rate" DECIMAL(9,8) NOT NULL, "withholding_rate" DECIMAL(9,8) NOT NULL, "commission_rate" DECIMAL(9,8) NOT NULL,
  "hourly_rate" DECIMAL(20,8), "hours" DECIMAL(20,8), "calculation_version" TEXT NOT NULL DEFAULT 'income-v1',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("source_id", "version"), CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on"),
  FOREIGN KEY ("source_id", "user_id") REFERENCES "income_sources"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("account_id", "user_id") REFERENCES "accounts"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("space_id", "account_id", "user_id") REFERENCES "spaces"("id", "account_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "income_revisions_user_id_account_id_idx" ON "income_revisions"("user_id", "account_id");
CREATE TABLE "commitment_sources" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "archived_from_month" CHAR(7), "version" INTEGER NOT NULL DEFAULT 1, UNIQUE ("id", "user_id")
);
CREATE INDEX "commitment_sources_user_id_id_idx" ON "commitment_sources"("user_id", "id");
CREATE TABLE "commitment_revisions" (
  "id" UUID PRIMARY KEY, "source_id" UUID NOT NULL, "user_id" UUID NOT NULL, "version" INTEGER NOT NULL,
  "name" VARCHAR(120) NOT NULL, "effective_from_month" CHAR(7) NOT NULL, "starts_on" DATE NOT NULL, "ends_on" DATE,
  "account_id" UUID NOT NULL, "space_id" UUID, "input" JSONB NOT NULL, "amount_cents" BIGINT NOT NULL CHECK ("amount_cents" >= 0),
  "calculation_version" TEXT NOT NULL DEFAULT 'commitment-v1', "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("source_id", "version"), CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on"),
  FOREIGN KEY ("source_id", "user_id") REFERENCES "commitment_sources"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("account_id", "user_id") REFERENCES "accounts"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("space_id", "account_id", "user_id") REFERENCES "spaces"("id", "account_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "commitment_revisions_user_id_account_id_idx" ON "commitment_revisions"("user_id", "account_id");
CREATE TABLE "commitment_installments" (
  "revision_id" UUID NOT NULL REFERENCES "commitment_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ordinal" INTEGER NOT NULL, "month" INTEGER NOT NULL CHECK ("month" BETWEEN 1 AND 12),
  "day" INTEGER NOT NULL CHECK ("day" BETWEEN 1 AND 31), "amount_cents" BIGINT NOT NULL CHECK ("amount_cents" >= 0),
  PRIMARY KEY ("revision_id", "ordinal")
);
CREATE TABLE "financial_events" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "entity_type" VARCHAR(32) NOT NULL, "entity_id" UUID NOT NULL, "action" VARCHAR(32) NOT NULL,
  "payload" JSONB NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "financial_events_user_id_entity_type_entity_id_idx" ON "financial_events"("user_id", "entity_type", "entity_id");
