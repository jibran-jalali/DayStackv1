import { z } from "zod";

import { taskFormSchema } from "@/types/daystack";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Use a valid time.");
const weekdaySchema = z.number().int().min(0).max(6);
const taskTypeSchema = z.enum(["blocked", "generic", "meeting"]);
const blockModeSchema = z.enum(["one_time", "recurring"]);
const participantSchema = z.object({
  fullName: z.string().trim().min(1, "Use a valid participant."),
  id: z.string().uuid("Use a valid participant."),
});

export const assistantConversationMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  role: z.enum(["assistant", "user"]),
});

export const assistantContextTaskSchema = z.object({
  acceptedCopiesCount: z.number().int().min(0),
  endTime: timeSchema,
  id: z.string().uuid(),
  meetingLink: z.string().nullable(),
  participants: z.array(participantSchema).max(8),
  recurringSeriesId: z.string().uuid().nullable(),
  recurringWeekdays: z.array(weekdaySchema).max(7),
  startTime: timeSchema,
  status: z.enum(["completed", "pending"]),
  taskDate: dateKeySchema,
  taskType: taskTypeSchema,
  title: z.string().trim().min(1).max(120),
});

export const assistantContextRecurringBlockSchema = z.object({
  effectiveEndDate: dateKeySchema.nullable(),
  effectiveStartDate: dateKeySchema,
  endTime: timeSchema,
  meetingLink: z.string().nullable(),
  nextOccurrenceDate: dateKeySchema.nullable(),
  participants: z.array(participantSchema).max(8),
  seriesId: z.string().uuid(),
  startTime: timeSchema,
  taskType: taskTypeSchema,
  title: z.string().trim().min(1).max(120),
  weekdays: z.array(weekdaySchema).max(7),
});

export const assistantSummarySchema = z.object({
  completedTasks: z.number().int().min(0),
  completionRate: z.number().int().min(0).max(100),
  executionScore: z.number().int().min(0).max(100),
  incompleteTasks: z.number().int().min(0),
  successfulDay: z.boolean(),
  summaryLine: z.string().trim().min(1).max(300),
  totalTasks: z.number().int().min(0),
});

export const assistantContextSchema = z.object({
  currentDate: dateKeySchema,
  currentTimeIso: z.string().datetime({ offset: true }),
  recurringBlocks: z.array(assistantContextRecurringBlockSchema).max(50),
  streak: z.number().int().min(0),
  summary: assistantSummarySchema,
  tasks: z.array(assistantContextTaskSchema).max(100),
  timezone: z.string().trim().min(1).max(100),
});

export const createAssistantTaskValuesSchema = taskFormSchema;

export const assistantTaskDraftSchema = z.object({
  blockMode: blockModeSchema.optional(),
  endTime: timeSchema.optional(),
  meetingLink: z.union([z.string().trim().max(500), z.literal(""), z.null()]).optional(),
  participants: z.array(participantSchema).max(8).optional(),
  startTime: timeSchema.optional(),
  taskDate: dateKeySchema.optional(),
  taskType: taskTypeSchema.optional(),
  title: z.string().trim().min(1).max(120).optional(),
  weekdays: z.array(weekdaySchema).max(7).optional(),
});

export const assistantMissingFieldSchema = z.enum([
  "endTime",
  "startTime",
  "taskDate",
  "taskType",
  "title",
  "weekdays",
]);

export const assistantVisibleTaskCandidateSchema = z.object({
  endTime: timeSchema,
  id: z.string().uuid(),
  taskDate: dateKeySchema,
  taskType: taskTypeSchema,
  title: z.string().trim().min(1).max(120),
  startTime: timeSchema,
});

const taskChangeFields = {
  endTime: timeSchema.optional(),
  meetingLink: z.union([z.string().trim().max(500), z.literal(""), z.null()]).optional(),
  participants: z.array(participantSchema).max(8).optional(),
  startTime: timeSchema.optional(),
  taskDate: dateKeySchema.optional(),
  taskType: taskTypeSchema.optional(),
  title: z.string().trim().min(1).max(120).optional(),
  weekdays: z.array(weekdaySchema).max(7).optional(),
} as const;

export const assistantTaskChangesSchema = z
  .object(taskChangeFields)
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Include at least one change.",
  });

export const assistantRescheduleChangesSchema = z
  .object({
    endTime: timeSchema.optional(),
    startTime: timeSchema.optional(),
    taskDate: dateKeySchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Include at least one reschedule change.",
  });

export const assistantAnswerOnlyActionSchema = z.object({
  kind: z.literal("answer_only"),
});

export const assistantCreateTaskFollowUpSchema = z.object({
  draft: assistantTaskDraftSchema,
  kind: z.literal("create_task"),
  missingField: assistantMissingFieldSchema,
});

export const assistantTaskSelectionFollowUpSchema = z.object({
  candidates: z.array(assistantVisibleTaskCandidateSchema).min(1).max(8),
  changes: z.union([assistantTaskChangesSchema, assistantRescheduleChangesSchema]).optional(),
  intent: z.enum(["delete_task", "reschedule_task", "toggle_task_status", "update_task"]),
  kind: z.literal("task_selection"),
  propagationMode: z.enum(["owner_and_accepted_copies", "owner_only"]).optional(),
  recurrenceScope: z.enum(["occurrence_only", "this_and_future"]).optional(),
  status: z.enum(["completed", "pending"]).optional(),
});

export const assistantFollowUpContextSchema = z.discriminatedUnion("kind", [
  assistantCreateTaskFollowUpSchema,
  assistantTaskSelectionFollowUpSchema,
]);

export const assistantAskFollowupActionSchema = z.object({
  followUp: assistantFollowUpContextSchema.optional(),
  kind: z.literal("ask_followup"),
  question: z.string().trim().min(1).max(500),
});

export const assistantCreateTaskActionSchema = z.object({
  kind: z.literal("create_task"),
  values: createAssistantTaskValuesSchema,
});

export const assistantBatchCreateTasksActionSchema = z.object({
  deferredItems: z
    .array(
      z.object({
        reason: z.string().trim().min(1).max(200),
        title: z.string().trim().min(1).max(120),
      }),
    )
    .max(20)
    .default([]),
  headline: z.string().trim().min(1).max(300).optional(),
  kind: z.literal("batch_create_tasks"),
  values: z.array(createAssistantTaskValuesSchema).min(1).max(20),
});

export const assistantUpdateTaskActionSchema = z.object({
  changes: assistantTaskChangesSchema,
  kind: z.literal("update_task"),
  propagationMode: z.enum(["owner_and_accepted_copies", "owner_only"]).optional(),
  recurrenceScope: z.enum(["occurrence_only", "this_and_future"]).optional(),
  taskId: z.string().uuid(),
});

export const assistantRescheduleTaskActionSchema = z.object({
  changes: assistantRescheduleChangesSchema,
  kind: z.literal("reschedule_task"),
  propagationMode: z.enum(["owner_and_accepted_copies", "owner_only"]).optional(),
  recurrenceScope: z.enum(["occurrence_only", "this_and_future"]).optional(),
  taskId: z.string().uuid(),
});

export const assistantToggleTaskStatusActionSchema = z.object({
  kind: z.literal("toggle_task_status"),
  status: z.enum(["completed", "pending"]),
  taskId: z.string().uuid(),
});

export const assistantDeleteTaskActionSchema = z.object({
  kind: z.literal("delete_task"),
  recurrenceScope: z.enum(["occurrence_only", "this_and_future"]).optional(),
  taskId: z.string().uuid(),
});

export const assistantUpdateRecurringSeriesActionSchema = z.object({
  changes: assistantTaskChangesSchema,
  fromDate: dateKeySchema.optional(),
  kind: z.literal("update_recurring_series"),
  seriesId: z.string().uuid(),
});

export const assistantDeleteRecurringSeriesActionSchema = z.object({
  fromDate: dateKeySchema.optional(),
  kind: z.literal("delete_recurring_series"),
  seriesId: z.string().uuid(),
});

export const assistantActionSchema = z.discriminatedUnion("kind", [
  assistantAnswerOnlyActionSchema,
  assistantAskFollowupActionSchema,
  assistantCreateTaskActionSchema,
  assistantBatchCreateTasksActionSchema,
  assistantUpdateTaskActionSchema,
  assistantRescheduleTaskActionSchema,
  assistantToggleTaskStatusActionSchema,
  assistantDeleteTaskActionSchema,
  assistantUpdateRecurringSeriesActionSchema,
  assistantDeleteRecurringSeriesActionSchema,
]);

export const assistantMutationActionSchema = z.discriminatedUnion("kind", [
  assistantCreateTaskActionSchema,
  assistantBatchCreateTasksActionSchema,
  assistantUpdateTaskActionSchema,
  assistantRescheduleTaskActionSchema,
  assistantToggleTaskStatusActionSchema,
  assistantDeleteTaskActionSchema,
  assistantUpdateRecurringSeriesActionSchema,
  assistantDeleteRecurringSeriesActionSchema,
]);

export const assistantModelResponseSchema = z.object({
  action: assistantActionSchema,
  reply: z.string().trim().min(1).max(4000),
});

export const assistantChatRequestSchema = z.object({
  context: assistantContextSchema,
  message: z.string().trim().min(1).max(4000),
  messages: z.array(assistantConversationMessageSchema).max(12).default([]),
  pendingFollowUp: assistantFollowUpContextSchema.nullish(),
});

export const assistantExecuteRequestSchema = z.object({
  action: assistantMutationActionSchema,
  context: assistantContextSchema,
});

export type AssistantAction = z.infer<typeof assistantActionSchema>;
export type AssistantChatRequest = z.infer<typeof assistantChatRequestSchema>;
export type AssistantContext = z.infer<typeof assistantContextSchema>;
export type AssistantContextRecurringBlock = z.infer<typeof assistantContextRecurringBlockSchema>;
export type AssistantContextTask = z.infer<typeof assistantContextTaskSchema>;
export type AssistantConversationMessage = z.infer<typeof assistantConversationMessageSchema>;
export type AssistantExecuteRequest = z.infer<typeof assistantExecuteRequestSchema>;
export type AssistantFollowUpContext = z.infer<typeof assistantFollowUpContextSchema>;
export type AssistantMissingField = z.infer<typeof assistantMissingFieldSchema>;
export type AssistantModelResponse = z.infer<typeof assistantModelResponseSchema>;
export type AssistantMutationAction = z.infer<typeof assistantMutationActionSchema>;
export type AssistantTaskDraft = z.infer<typeof assistantTaskDraftSchema>;
export type AssistantVisibleTaskCandidate = z.infer<typeof assistantVisibleTaskCandidateSchema>;
