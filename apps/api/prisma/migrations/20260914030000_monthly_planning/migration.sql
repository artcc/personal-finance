CREATE TABLE "monthly_plans" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "month" CHAR(7) NOT NULL,
  "current_revision" INTEGER NOT NULL DEFAULT 1 CHECK ("current_revision" > 0),
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("user_id", "month"), UNIQUE ("id", "user_id")
);
CREATE TABLE "monthly_plan_revisions" (
  "id" UUID PRIMARY KEY, "plan_id" UUID NOT NULL, "user_id" UUID NOT NULL,
  "number" INTEGER NOT NULL CHECK ("number" > 0), "version" INTEGER NOT NULL CHECK ("version" > 0),
  "state" VARCHAR(8) NOT NULL CHECK ("state" IN ('draft', 'closed')),
  "snapshot" JSONB NOT NULL, "summary" JSONB NOT NULL,
  "expected_cash_cents" BIGINT NOT NULL, "tax_reserve_cents" BIGINT NOT NULL,
  "charges_cents" BIGINT NOT NULL, "availability_cents" BIGINT NOT NULL,
  "allocated_cash_cents" BIGINT NOT NULL, "funding_gap_cents" BIGINT NOT NULL,
  "reopen_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, "closed_at" TIMESTAMPTZ(3),
  CHECK (("state" = 'closed') = ("closed_at" IS NOT NULL)),
  FOREIGN KEY ("plan_id", "user_id") REFERENCES "monthly_plans"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE ("plan_id", "number")
);
CREATE INDEX "monthly_plan_revisions_user_id_plan_id_idx" ON "monthly_plan_revisions"("user_id", "plan_id");

CREATE FUNCTION "protect_closed_plan_revision"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."state" = 'closed' THEN
    RAISE EXCEPTION 'Closed monthly plan revisions cannot be updated';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "monthly_plan_revision_immutable_after_close"
BEFORE UPDATE ON "monthly_plan_revisions"
FOR EACH ROW EXECUTE FUNCTION "protect_closed_plan_revision"();
