CREATE TYPE "public"."reminder_status" AS ENUM('pending', 'processing', 'sent', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."reminder_type" AS ENUM('5_minutes_before', 'at_start', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."task_notification_status" AS ENUM('pending', 'accepted', 'dismissed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."task_notification_type" AS ENUM('task_mention');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('generic', 'meeting', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "daily_summaries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"summary_date" date NOT NULL,
	"total_tasks" integer DEFAULT 0 NOT NULL,
	"completed_tasks" integer DEFAULT 0 NOT NULL,
	"execution_score" integer DEFAULT 0 NOT NULL,
	"successful_day" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"notification_type" "task_notification_type" DEFAULT 'task_mention' NOT NULL,
	"status" "task_notification_status" DEFAULT 'pending' NOT NULL,
	"read_at" timestamp with time zone,
	"accepted_task_id" uuid,
	"task_title" text NOT NULL,
	"task_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"task_type" "task_type" NOT NULL,
	"meeting_link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_reminders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reminder_type" "reminder_type" NOT NULL,
	"remind_at" timestamp with time zone NOT NULL,
	"status" "reminder_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"task_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"task_type" "task_type" DEFAULT 'generic' NOT NULL,
	"meeting_link" text,
	"source_task_id" uuid,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"push_enabled" boolean DEFAULT false NOT NULL,
	"remind_at_start" boolean DEFAULT true NOT NULL,
	"remind_5_min_before" boolean DEFAULT true NOT NULL,
	"remind_overdue" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"password_hash" text NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_accepted_task_id_tasks_id_fk" FOREIGN KEY ("accepted_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_participants" ADD CONSTRAINT "task_participants_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_participants" ADD CONSTRAINT "task_participants_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_summaries_user_date_idx" ON "daily_summaries" USING btree ("user_id","summary_date");--> statement-breakpoint
CREATE UNIQUE INDEX "task_notifications_task_user_type_uidx" ON "task_notifications" USING btree ("task_id","user_id","notification_type");--> statement-breakpoint
CREATE INDEX "task_notifications_user_created_idx" ON "task_notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "task_notifications_actor_created_idx" ON "task_notifications" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "task_notifications_user_unread_idx" ON "task_notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_participants_task_participant_uidx" ON "task_participants" USING btree ("task_id","participant_id");--> statement-breakpoint
CREATE INDEX "task_participants_task_id_idx" ON "task_participants" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_participants_participant_id_idx" ON "task_participants" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_reminders_task_type_time_uidx" ON "task_reminders" USING btree ("task_id","reminder_type","remind_at");--> statement-breakpoint
CREATE INDEX "task_reminders_due_idx" ON "task_reminders" USING btree ("status","remind_at");--> statement-breakpoint
CREATE INDEX "task_reminders_user_due_idx" ON "task_reminders" USING btree ("user_id","status","remind_at");--> statement-breakpoint
CREATE INDEX "tasks_user_date_start_idx" ON "tasks" USING btree ("user_id","task_date","start_time");--> statement-breakpoint
CREATE INDEX "tasks_user_date_status_idx" ON "tasks" USING btree ("user_id","task_date","status");--> statement-breakpoint
CREATE INDEX "tasks_user_date_type_idx" ON "tasks" USING btree ("user_id","task_date","task_type");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_user_source_task_uidx" ON "tasks" USING btree ("user_id","source_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_full_name_idx" ON "users" USING btree ("full_name");