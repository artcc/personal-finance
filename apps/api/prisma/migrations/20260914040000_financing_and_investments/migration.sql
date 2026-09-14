CREATE TABLE "financings" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "planning_source_id" UUID NOT NULL UNIQUE, "name" VARCHAR(120) NOT NULL, "lender" VARCHAR(120),
  "original_principal_cents" BIGINT CHECK ("original_principal_cents" >= 0), "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE ("id", "user_id"),
  FOREIGN KEY ("planning_source_id", "user_id") REFERENCES "commitment_sources"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "financings_user_id_name_id_idx" ON "financings"("user_id", "name", "id");
CREATE TABLE "financing_balances" (
  "id" UUID PRIMARY KEY, "financing_id" UUID NOT NULL, "user_id" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "as_of" DATE NOT NULL, "amount_cents" BIGINT NOT NULL CHECK ("amount_cents" >= 0),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE ("financing_id", "sequence"),
  FOREIGN KEY ("financing_id", "user_id") REFERENCES "financings"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "financing_balances_user_id_financing_id_as_of_idx" ON "financing_balances"("user_id", "financing_id", "as_of");
CREATE TABLE "investments" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "planning_source_id" UUID UNIQUE, "name" VARCHAR(120) NOT NULL, "platform" VARCHAR(120), "ticker" VARCHAR(30),
  "kind" VARCHAR(16) NOT NULL CHECK ("kind" IN ('fund','pension','crypto','other')),
  "mode" VARCHAR(16) NOT NULL CHECK ("mode" IN ('contributions','units')), "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE ("id", "user_id"),
  FOREIGN KEY ("planning_source_id", "user_id") REFERENCES "commitment_sources"("id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "investments_user_id_name_id_idx" ON "investments"("user_id", "name", "id");
CREATE TABLE "investment_entries" (
  "id" UUID PRIMARY KEY, "investment_id" UUID NOT NULL, "user_id" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "date" DATE NOT NULL, "order_sequence" INTEGER NOT NULL, "kind" VARCHAR(16) NOT NULL CHECK ("kind" IN ('opening','contribution','withdrawal','buy','sell')),
  "quantity" NUMERIC(20,8) CHECK ("quantity" >= 0), "amount_cents" BIGINT CHECK ("amount_cents" >= 0),
  "note" VARCHAR(500), "replaces_id" UUID, "voided_at" TIMESTAMPTZ(3), "void_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (("voided_at" IS NULL) = ("void_reason" IS NULL)), UNIQUE ("investment_id", "sequence"),
  FOREIGN KEY ("investment_id", "user_id") REFERENCES "investments"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "investment_entries_user_id_investment_id_date_sequence_idx" ON "investment_entries"("user_id", "investment_id", "date", "sequence");
CREATE UNIQUE INDEX "investment_entries_active_order_key" ON "investment_entries"("investment_id", "order_sequence") WHERE "voided_at" IS NULL;
CREATE TABLE "investment_valuations" (
  "id" UUID PRIMARY KEY, "investment_id" UUID NOT NULL, "user_id" UUID NOT NULL, "sequence" INTEGER NOT NULL,
  "as_of" DATE NOT NULL, "amount_cents" BIGINT NOT NULL CHECK ("amount_cents" >= 0),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE ("investment_id", "sequence"),
  FOREIGN KEY ("investment_id", "user_id") REFERENCES "investments"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "investment_valuations_user_id_investment_id_as_of_idx" ON "investment_valuations"("user_id", "investment_id", "as_of");
