ALTER TABLE "tasks" ADD CONSTRAINT "tasks_title_not_blank_chk" CHECK (length(trim("tasks"."title")) > 0);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_time_order_chk" CHECK ("tasks"."end_time" > "tasks"."start_time");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_not_blank_chk" CHECK (length(trim("users"."email")) > 0);