import { z } from "zod";
import type { InferSelectModel } from "drizzle-orm";

import type {
  daily_summaries,
  recurring_rule_exceptions,
  recurring_rule_participants,
  recurring_rules,
  task_notifications,
  task_participants,
  task_reminders,
  tasks,
  user_notification_preferences,
  users,
} from "@/db/schema";

export type UserRecord = InferSelectModel<typeof users>;
export type TaskRecord = InferSelectModel<typeof tasks>;
export type DailySummaryRecord = InferSelectModel<typeof daily_summaries>;
export type ProfileRecord = UserRecord;
export type TaskParticipantRecord = InferSelectModel<typeof task_participants>;
export type UserNotificationPreferencesRecord = InferSelectModel<typeof user_notification_preferences>;
export type TaskReminderRecord = InferSelectModel<typeof task_reminders>;
export type TaskNotificationRecord = InferSelectModel<typeof task_notifications>;
export type RecurringRuleRecord = InferSelectModel<typeof recurring_rules>;
export type RecurringRuleParticipantRecord = InferSelectModel<typeof recurring_rule_participants>;
export type RecurringRuleExceptionRecord = InferSelectModel<typeof recurring_rule_exceptions>;
export type TaskType = TaskRecord["task_type"];
export type ReminderType = TaskReminderRecord["reminder_type"];
export type ReminderStatus = TaskReminderRecord["status"];
export type TaskNotificationStatus = TaskNotificationRecord["status"];
export type TaskPropagationMode = "owner_only" | "owner_and_accepted_copies";
export type TaskMode = "one_time" | "recurring";
export type RecurringTaskScope = "occurrence_only" | "this_and_future";

export interface ParticipantProfile {
  email?: string | null;
  id: string;
  fullName: string;
}

export type NotificationSupportState =
  | "available"
  | "missing-config"
  | "needs-install"
  | "permission-denied"
  | "subscribed"
  | "unsupported";

export type NotificationPlatform = "android" | "desktop" | "ios" | "unknown";

export interface PlannerTask extends TaskRecord {
  acceptedCopiesCount: number;
  participants: ParticipantProfile[];
  recurringSeriesId: string | null;
  recurringWeekdays: number[];
}

export interface PlannerNotification {
  acceptedTaskDate: string | null;
  acceptedTaskId: string | null;
  actor: ParticipantProfile | null;
  actorId: string;
  createdAt: string;
  id: string;
  meetingLink: string | null;
  notificationType: TaskNotificationRecord["notification_type"];
  readAt: string | null;
  startTime: string;
  endTime: string;
  status: TaskNotificationStatus;
  taskDate: string;
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
}

export interface TaskNotificationAcceptResult {
  acceptedTaskId: string | null;
  outcome: "accepted" | "already_accepted" | "task_missing";
  taskDate: string;
}

export interface OneSignalSubscriptionState {
  browserLabel: string;
  configured: boolean;
  isStandalone: boolean;
  permissionGranted: boolean;
  permissionStatus: NotificationPermission | "unsupported";
  platform: NotificationPlatform;
  ready: boolean;
  supportState: NotificationSupportState;
  supported: boolean;
  subscribed: boolean;
  subscriptionId: string | null;
}

export const emailSchema = z.string().trim().email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.");

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = loginSchema.extend({
  fullName: z
    .string()
    .trim()
    .max(80, "Use 80 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

const participantSchema = z.object({
  id: z.string().uuid("Use a valid participant."),
  fullName: z.string().trim().min(1, "Use a valid participant."),
});

function getWeekdayFromDateKey(taskDate: string) {
  const [year, month, day] = taskDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export const taskFormSchema = z
  .object({
    blockMode: z.enum(["one_time", "recurring"]).default("one_time"),
    title: z
      .string()
      .trim()
      .min(1, "Add a task title.")
      .max(120, "Keep the title under 120 characters."),
    taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use a valid start time."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use a valid end time."),
    taskType: z.enum(["generic", "meeting", "blocked"]),
    meetingLink: z
      .string()
      .trim()
      .max(500, "Keep the link under 500 characters.")
      .optional()
      .or(z.literal("")),
    participants: z.array(participantSchema).max(8, "Keep the participant list focused.").default([]),
    weekdays: z
      .array(z.number().int().min(0, "Use a valid weekday.").max(6, "Use a valid weekday."))
      .default([]),
  })
  .refine((values) => values.endTime > values.startTime, {
    message: "End time must be later than the start time.",
    path: ["endTime"],
  })
  .refine(
    (values) => {
      if (!values.meetingLink) {
        return true;
      }

      try {
        const url = new URL(values.meetingLink);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    {
      message: "Use a valid meeting link.",
      path: ["meetingLink"],
    },
  )
  .refine((values) => (values.taskType === "meeting" ? true : !values.meetingLink), {
    message: "Meeting links are only available for meeting blocks.",
    path: ["meetingLink"],
  })
  .refine((values) => (values.taskType === "meeting" ? true : values.participants.length === 0), {
    message: "Participants are only available for meeting blocks.",
    path: ["participants"],
  })
  .refine((values) => (values.blockMode === "recurring" ? values.weekdays.length > 0 : true), {
    message: "Pick at least one weekday for a recurring block.",
    path: ["weekdays"],
  })
  .refine(
    (values) => {
      if (values.blockMode !== "recurring") {
        return values.weekdays.length === 0;
      }

      return new Set(values.weekdays).size === values.weekdays.length;
    },
    {
      message: "Each weekday should only be selected once.",
      path: ["weekdays"],
    },
  )
  .refine(
    (values) => (
      values.blockMode === "recurring"
        ? values.weekdays.includes(getWeekdayFromDateKey(values.taskDate))
        : true
    ),
    {
      message: "Include the selected date's weekday so the recurring block can start on that day.",
      path: ["weekdays"],
    },
  );

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type TaskFormValues = z.infer<typeof taskFormSchema>;

export interface DashboardSummary {
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  completionRate: number;
  executionScore: number;
  successfulDay: boolean;
  summaryLine: string;
}

export interface LeaderboardEntry {
  userId: string;
  rank: number;
  displayName: string;
  publicLabel: string;
  currentStreak: number;
  latestExecutionScore: number;
}

export interface RecurringBlockSummary {
  seriesId: string;
  title: string;
  taskType: TaskType;
  meetingLink: string | null;
  startTime: string;
  endTime: string;
  weekdays: number[];
  participants: ParticipantProfile[];
  effectiveStartDate: string;
  effectiveEndDate: string | null;
  nextOccurrenceDate: string | null;
}

export interface DashboardSnapshot {
  taskDate: string;
  tasks: PlannerTask[];
  recentSummaries: DailySummaryRecord[];
  leaderboard: LeaderboardEntry[];
  recurringBlocks: RecurringBlockSummary[];
  summary: DashboardSummary;
  streak: number;
}

export interface DueTaskReminder {
  reminder: TaskReminderRecord;
  preferences: UserNotificationPreferencesRecord;
  task: Pick<
    TaskRecord,
    "end_time" | "id" | "meeting_link" | "start_time" | "status" | "task_date" | "task_type" | "title" | "user_id"
  >;
}

export type PlannerDateMode = "past" | "today" | "future";

export type TaskVisualState = "active" | "completed" | "upcoming" | "pending" | "overdue";

export interface TaskWindowState {
  currentTask: PlannerTask | null;
  nextTask: PlannerTask | null;
}

export interface TimelineTaskLayout {
  task: PlannerTask;
  clusterId: string;
  column: number;
  columns: number;
  startMinutes: number;
  endMinutes: number;
}
