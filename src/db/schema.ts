import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);
export const taskTypeEnum = pgEnum("task_type", ["generic", "meeting", "blocked"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "completed"]);
export const reminderTypeEnum = pgEnum("reminder_type", ["5_minutes_before", "at_start", "overdue"]);
export const reminderStatusEnum = pgEnum("reminder_status", ["pending", "processing", "sent", "skipped", "failed"]);
export const taskNotificationTypeEnum = pgEnum("task_notification_type", ["task_mention"]);
export const taskNotificationStatusEnum = pgEnum("task_notification_status", ["pending", "accepted", "dismissed", "expired"]);

const timestampColumn = (name: string) =>
  timestamp(name, {
    withTimezone: true,
    mode: "string",
  })
    .notNull()
    .defaultNow();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    full_name: text("full_name"),
    password_hash: text("password_hash").notNull(),
    status: userStatusEnum("status").notNull().default("active"),
    last_sign_in_at: timestamp("last_sign_in_at", {
      withTimezone: true,
      mode: "string",
    }),
    created_at: timestampColumn("created_at"),
    updated_at: timestampColumn("updated_at"),
  },
  (table) => [
    uniqueIndex("users_email_uidx").on(table.email),
    index("users_status_idx").on(table.status),
    index("users_full_name_idx").on(table.full_name),
    check("users_email_not_blank_chk", sql`length(trim(${table.email})) > 0`),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    task_date: date("task_date", { mode: "string" }).notNull(),
    start_time: time("start_time").notNull(),
    end_time: time("end_time").notNull(),
    task_type: taskTypeEnum("task_type").notNull().default("generic"),
    meeting_link: text("meeting_link"),
    source_task_id: uuid("source_task_id"),
    status: taskStatusEnum("status").notNull().default("pending"),
    created_at: timestampColumn("created_at"),
    updated_at: timestampColumn("updated_at"),
  },
  (table) => [
    index("tasks_user_date_start_idx").on(table.user_id, table.task_date, table.start_time),
    index("tasks_user_date_status_idx").on(table.user_id, table.task_date, table.status),
    index("tasks_user_date_type_idx").on(table.user_id, table.task_date, table.task_type),
    uniqueIndex("tasks_user_source_task_uidx").on(table.user_id, table.source_task_id),
    check("tasks_title_not_blank_chk", sql`length(trim(${table.title})) > 0`),
    check("tasks_time_order_chk", sql`${table.end_time} > ${table.start_time}`),
  ],
);

export const task_participants = pgTable(
  "task_participants",
  {
    id: uuid("id").primaryKey(),
    task_id: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    participant_id: uuid("participant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created_at: timestampColumn("created_at"),
  },
  (table) => [
    uniqueIndex("task_participants_task_participant_uidx").on(table.task_id, table.participant_id),
    index("task_participants_task_id_idx").on(table.task_id),
    index("task_participants_participant_id_idx").on(table.participant_id),
  ],
);

export const daily_summaries = pgTable(
  "daily_summaries",
  {
    id: uuid("id").primaryKey(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    summary_date: date("summary_date", { mode: "string" }).notNull(),
    total_tasks: integer("total_tasks").notNull().default(0),
    completed_tasks: integer("completed_tasks").notNull().default(0),
    execution_score: integer("execution_score").notNull().default(0),
    successful_day: boolean("successful_day").notNull().default(false),
    created_at: timestampColumn("created_at"),
    updated_at: timestampColumn("updated_at"),
  },
  (table) => [uniqueIndex("daily_summaries_user_date_idx").on(table.user_id, table.summary_date)],
);

export const user_notification_preferences = pgTable("user_notification_preferences", {
  user_id: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  push_enabled: boolean("push_enabled").notNull().default(false),
  remind_at_start: boolean("remind_at_start").notNull().default(true),
  remind_5_min_before: boolean("remind_5_min_before").notNull().default(true),
  remind_overdue: boolean("remind_overdue").notNull().default(false),
  created_at: timestampColumn("created_at"),
  updated_at: timestampColumn("updated_at"),
});

export const task_reminders = pgTable(
  "task_reminders",
  {
    id: uuid("id").primaryKey(),
    task_id: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reminder_type: reminderTypeEnum("reminder_type").notNull(),
    remind_at: timestamp("remind_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    status: reminderStatusEnum("status").notNull().default("pending"),
    sent_at: timestamp("sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    created_at: timestampColumn("created_at"),
    updated_at: timestampColumn("updated_at"),
  },
  (table) => [
    uniqueIndex("task_reminders_task_type_time_uidx").on(table.task_id, table.reminder_type, table.remind_at),
    index("task_reminders_due_idx").on(table.status, table.remind_at),
    index("task_reminders_user_due_idx").on(table.user_id, table.status, table.remind_at),
  ],
);

export const task_notifications = pgTable(
  "task_notifications",
  {
    id: uuid("id").primaryKey(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actor_user_id: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    task_id: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    notification_type: taskNotificationTypeEnum("notification_type").notNull().default("task_mention"),
    status: taskNotificationStatusEnum("status").notNull().default("pending"),
    read_at: timestamp("read_at", {
      withTimezone: true,
      mode: "string",
    }),
    accepted_task_id: uuid("accepted_task_id").references(() => tasks.id, { onDelete: "set null" }),
    task_title: text("task_title").notNull(),
    task_date: date("task_date", { mode: "string" }).notNull(),
    start_time: time("start_time").notNull(),
    end_time: time("end_time").notNull(),
    task_type: taskTypeEnum("task_type").notNull(),
    meeting_link: text("meeting_link"),
    created_at: timestampColumn("created_at"),
    updated_at: timestampColumn("updated_at"),
  },
  (table) => [
    uniqueIndex("task_notifications_task_user_type_uidx").on(table.task_id, table.user_id, table.notification_type),
    index("task_notifications_user_created_idx").on(table.user_id, table.created_at),
    index("task_notifications_actor_created_idx").on(table.actor_user_id, table.created_at),
    index("task_notifications_user_unread_idx").on(table.user_id, table.read_at, table.created_at),
  ],
);
