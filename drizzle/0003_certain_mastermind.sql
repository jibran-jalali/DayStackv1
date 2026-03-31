ALTER TABLE "recurring_rules" ADD COLUMN "series_id" uuid;--> statement-breakpoint
UPDATE "recurring_rules" SET "series_id" = "id" WHERE "series_id" IS NULL;--> statement-breakpoint
ALTER TABLE "recurring_rules" ALTER COLUMN "series_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "recurring_rules_user_series_idx" ON "recurring_rules" USING btree ("user_id","series_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_rules_series_weekday_uidx" ON "recurring_rules" USING btree ("series_id","weekday");
