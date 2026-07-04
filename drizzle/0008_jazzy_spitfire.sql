CREATE TABLE "google_calendar_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"google_email" text,
	"calendar_id" text DEFAULT 'primary' NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"scope" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_calendar_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"google_calendar_id" text DEFAULT 'primary' NOT NULL,
	"google_event_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_calendar_events" ADD CONSTRAINT "task_calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_calendar_events" ADD CONSTRAINT "task_calendar_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "google_calendar_connections_updated_idx" ON "google_calendar_connections" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_calendar_events_task_uidx" ON "task_calendar_events" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_calendar_events_google_event_uidx" ON "task_calendar_events" USING btree ("user_id","google_calendar_id","google_event_id");--> statement-breakpoint
CREATE INDEX "task_calendar_events_user_idx" ON "task_calendar_events" USING btree ("user_id","updated_at");