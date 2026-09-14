CREATE TABLE "owners" (
    "id" UUID NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owners_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "owners_singleton_check" CHECK ("singleton" = true)
);

CREATE UNIQUE INDEX "owners_singleton_key" ON "owners"("singleton");
