CREATE TYPE "public"."recurring_rule_exception_type" AS ENUM('skip');--> statement-breakpoint
CREATE TABLE "recurring_rule_exceptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recurring_rule_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"exception_type" "recurring_rule_exception_type" DEFAULT 'skip' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_rule_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recurring_rule_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"title" text NOT NULL,
	"weekday" integer NOT NULL,
	"effective_start_date" date NOT NULL,
	"effective_end_date" date,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"task_type" "task_type" DEFAULT 'generic' NOT NULL,
	"meeting_link" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_rules_title_not_blank_chk" CHECK (length(trim("recurring_rules"."title")) > 0),
	CONSTRAINT "recurring_rules_weekday_range_chk" CHECK ("recurring_rules"."weekday" >= 0 and "recurring_rules"."weekday" <= 6),
	CONSTRAINT "recurring_rules_time_order_chk" CHECK ("recurring_rules"."end_time" > "recurring_rules"."start_time"),
	CONSTRAINT "recurring_rules_date_window_chk" CHECK ("recurring_rules"."effective_end_date" is null or "recurring_rules"."effective_end_date" >= "recurring_rules"."effective_start_date")
);
--> statement-breakpoint
CREATE TABLE "recurring_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_templates_name_not_blank_chk" CHECK (length(trim("recurring_templates"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurring_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurring_occurrence_date" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_rule_exceptions" ADD CONSTRAINT "recurring_rule_exceptions_recurring_rule_id_recurring_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rule_participants" ADD CONSTRAINT "recurring_rule_participants_recurring_rule_id_recurring_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rule_participants" ADD CONSTRAINT "recurring_rule_participants_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_template_id_recurring_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_rule_exceptions_rule_date_uidx" ON "recurring_rule_exceptions" USING btree ("recurring_rule_id","occurrence_date");--> statement-breakpoint
CREATE INDEX "recurring_rule_exceptions_rule_idx" ON "recurring_rule_exceptions" USING btree ("recurring_rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_rule_participants_rule_participant_uidx" ON "recurring_rule_participants" USING btree ("recurring_rule_id","participant_id");--> statement-breakpoint
CREATE INDEX "recurring_rule_participants_rule_idx" ON "recurring_rule_participants" USING btree ("recurring_rule_id");--> statement-breakpoint
CREATE INDEX "recurring_rule_participants_participant_idx" ON "recurring_rule_participants" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "recurring_rules_user_weekday_idx" ON "recurring_rules" USING btree ("user_id","weekday","is_active");--> statement-breakpoint
CREATE INDEX "recurring_rules_template_idx" ON "recurring_rules" USING btree ("template_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_templates_user_name_uidx" ON "recurring_templates" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "recurring_templates_user_active_idx" ON "recurring_templates" USING btree ("user_id","is_active");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurring_rule_id_recurring_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_recurring_rule_idx" ON "tasks" USING btree ("recurring_rule_id","recurring_occurrence_date");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_user_recurring_occurrence_uidx" ON "tasks" USING btree ("user_id","recurring_rule_id","recurring_occurrence_date");