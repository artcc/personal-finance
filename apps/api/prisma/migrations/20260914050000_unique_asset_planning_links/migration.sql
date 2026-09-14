CREATE UNIQUE INDEX "financings_planning_source_id_user_id_key"
ON "financings"("planning_source_id", "user_id");

CREATE UNIQUE INDEX "investments_planning_source_id_user_id_key"
ON "investments"("planning_source_id", "user_id");
