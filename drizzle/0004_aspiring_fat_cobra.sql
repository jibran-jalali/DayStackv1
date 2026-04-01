ALTER TYPE "public"."reminder_type" ADD VALUE 'email_before_start';--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD COLUMN "email_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD COLUMN "meeting_mention_email_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD COLUMN "email_reminder_lead_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_email_lead_range_chk" CHECK ("user_notification_preferences"."email_reminder_lead_minutes" >= 0 and "user_notification_preferences"."email_reminder_lead_minutes" <= 1440);