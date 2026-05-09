CREATE TYPE "public"."friend_connection_status" AS ENUM('pending', 'accepted');--> statement-breakpoint
CREATE TABLE "friend_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"user_one_id" uuid NOT NULL,
	"user_two_id" uuid NOT NULL,
	"status" "friend_connection_status" DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_connections_no_self_request_chk" CHECK ("friend_connections"."requester_id" <> "friend_connections"."addressee_id"),
	CONSTRAINT "friend_connections_pair_order_chk" CHECK ("friend_connections"."user_one_id" < "friend_connections"."user_two_id"),
	CONSTRAINT "friend_connections_pair_matches_request_chk" CHECK (("friend_connections"."requester_id" = "friend_connections"."user_one_id" and "friend_connections"."addressee_id" = "friend_connections"."user_two_id") or ("friend_connections"."requester_id" = "friend_connections"."user_two_id" and "friend_connections"."addressee_id" = "friend_connections"."user_one_id"))
);
--> statement-breakpoint
ALTER TABLE "friend_connections" ADD CONSTRAINT "friend_connections_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_connections" ADD CONSTRAINT "friend_connections_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_connections" ADD CONSTRAINT "friend_connections_user_one_id_users_id_fk" FOREIGN KEY ("user_one_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_connections" ADD CONSTRAINT "friend_connections_user_two_id_users_id_fk" FOREIGN KEY ("user_two_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_connections_pair_uidx" ON "friend_connections" USING btree ("user_one_id","user_two_id");--> statement-breakpoint
CREATE INDEX "friend_connections_requester_idx" ON "friend_connections" USING btree ("requester_id","status","created_at");--> statement-breakpoint
CREATE INDEX "friend_connections_addressee_idx" ON "friend_connections" USING btree ("addressee_id","status","created_at");--> statement-breakpoint
CREATE INDEX "friend_connections_user_one_idx" ON "friend_connections" USING btree ("user_one_id","status");--> statement-breakpoint
CREATE INDEX "friend_connections_user_two_idx" ON "friend_connections" USING btree ("user_two_id","status");--> statement-breakpoint
UPDATE "task_notifications"
SET "status" = 'expired',
	"read_at" = COALESCE("read_at", now()),
	"updated_at" = now()
WHERE "status" = 'pending'
	AND EXISTS (
		SELECT 1
		FROM "task_participants"
		INNER JOIN "tasks" ON "tasks"."id" = "task_participants"."task_id"
		WHERE "task_participants"."task_id" = "task_notifications"."task_id"
			AND "task_participants"."participant_id" = "task_notifications"."user_id"
			AND NOT EXISTS (
				SELECT 1
				FROM "friend_connections"
				WHERE "friend_connections"."status" = 'accepted'
					AND "friend_connections"."user_one_id" = LEAST("tasks"."user_id", "task_participants"."participant_id")
					AND "friend_connections"."user_two_id" = GREATEST("tasks"."user_id", "task_participants"."participant_id")
			)
	);--> statement-breakpoint
DELETE FROM "task_participants"
USING "tasks"
WHERE "tasks"."id" = "task_participants"."task_id"
	AND NOT EXISTS (
		SELECT 1
		FROM "friend_connections"
		WHERE "friend_connections"."status" = 'accepted'
			AND "friend_connections"."user_one_id" = LEAST("tasks"."user_id", "task_participants"."participant_id")
			AND "friend_connections"."user_two_id" = GREATEST("tasks"."user_id", "task_participants"."participant_id")
	);--> statement-breakpoint
DELETE FROM "recurring_rule_participants"
USING "recurring_rules"
WHERE "recurring_rules"."id" = "recurring_rule_participants"."recurring_rule_id"
	AND NOT EXISTS (
		SELECT 1
		FROM "friend_connections"
		WHERE "friend_connections"."status" = 'accepted'
			AND "friend_connections"."user_one_id" = LEAST("recurring_rules"."user_id", "recurring_rule_participants"."participant_id")
			AND "friend_connections"."user_two_id" = GREATEST("recurring_rules"."user_id", "recurring_rule_participants"."participant_id")
	);
