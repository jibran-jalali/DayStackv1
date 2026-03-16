import { z } from "zod";

import type { Database } from "@/types/database";

export type TaskRecord = Database["public"]["Tables"]["tasks"]["Row"];
export type DailySummaryRecord = Database["public"]["Tables"]["daily_summaries"]["Row"];
export type ProfileRecord = Database["public"]["Tables"]["profiles"]["Row"];
export type TaskParticipantRecord = Database["public"]["Tables"]["task_participants"]["Row"];
export type UserNotificationPreferencesRecord =
  Database["public"]["Tables"]["user_notification_preferences"]["Row"];
export type TaskReminderRecord = Database["public"]["Tables"]["task_reminders"]["Row"];
export type TaskType = TaskRecord["task_type"];
export type ReminderType = TaskReminderRecord["reminder_type"];
export type ReminderStatus = TaskReminderRecord["status"];

export interface ParticipantProfile {
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
  participants: ParticipantProfile[];
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

export const taskFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Add a task title.")
      .max(120, "Keep the title under 120 characters."),
    taskDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use a valid start time."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use a valid end time."),
    taskType: z.enum(["generic", "meeting"]),
    meetingLink: z
      .string()
      .trim()
      .max(500, "Keep the link under 500 characters.")
      .optional()
      .or(z.literal("")),
    participants: z.array(participantSchema).max(8, "Keep the participant list focused.").default([]),
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
  });

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

export interface DashboardSnapshot {
  taskDate: string;
  tasks: PlannerTask[];
  recentSummaries: DailySummaryRecord[];
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
