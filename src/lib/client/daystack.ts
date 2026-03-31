import type {
  DashboardSnapshot,
  RecurringTaskScope,
  TaskFormValues,
  TaskPropagationMode,
  TaskRecord,
} from "@/types/daystack";

import { requestJson } from "@/lib/client/request";

export async function fetchDashboardSnapshot(taskDate: string): Promise<DashboardSnapshot> {
  const searchParams = new URLSearchParams({
    date: taskDate,
  });
  const payload = await requestJson<{ snapshot: DashboardSnapshot }>(
    `/api/dashboard?${searchParams.toString()}`,
    {
      method: "GET",
      credentials: "same-origin",
    },
    "Dashboard load failed.",
  );

  return payload.snapshot;
}

export async function createTask(values: TaskFormValues): Promise<TaskRecord> {
  const payload = await requestJson<{ task: TaskRecord }>(
    "/api/tasks",
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(values),
    },
    "Task creation failed.",
  );

  return payload.task;
}

export async function updateTask(
  taskId: string,
  values: TaskFormValues,
  propagationMode: TaskPropagationMode = "owner_only",
  recurrenceScope: RecurringTaskScope = "occurrence_only",
): Promise<TaskRecord> {
  const payload = await requestJson<{ task: TaskRecord }>(
    `/api/tasks/${taskId}`,
    {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...values,
        propagationMode,
        recurrenceScope,
      }),
    },
    "Task update failed.",
  );

  return payload.task;
}

export async function rescheduleTask(
  taskId: string,
  values: Pick<TaskFormValues, "endTime" | "startTime" | "taskDate">,
  propagationMode: TaskPropagationMode = "owner_only",
  recurrenceScope: RecurringTaskScope = "occurrence_only",
): Promise<TaskRecord> {
  const payload = await requestJson<{ task: TaskRecord }>(
    `/api/tasks/${taskId}/reschedule`,
    {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...values,
        propagationMode,
        recurrenceScope,
      }),
    },
    "Task reschedule failed.",
  );

  return payload.task;
}

export async function deleteTask(
  taskId: string,
  recurrenceScope: RecurringTaskScope = "occurrence_only",
): Promise<string> {
  const payload = await requestJson<{ taskDate: string }>(
    `/api/tasks/${taskId}`,
    {
      method: "DELETE",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        recurrenceScope,
      }),
    },
    "Task deletion failed.",
  );

  return payload.taskDate;
}

export async function toggleTaskStatus(
  taskId: string,
  status: "pending" | "completed",
): Promise<TaskRecord> {
  const payload = await requestJson<{ task: TaskRecord }>(
    `/api/tasks/${taskId}/status`,
    {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status,
      }),
    },
    "Task status update failed.",
  );

  return payload.task;
}

export async function updateRecurringSeries(
  seriesId: string,
  values: TaskFormValues,
): Promise<void> {
  await requestJson<{ ok: true }>(
    `/api/recurring-series/${seriesId}`,
    {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(values),
    },
    "Recurring block update failed.",
  );
}

export async function deleteRecurringSeries(
  seriesId: string,
  fromDate: string,
): Promise<void> {
  await requestJson<{ ok: true }>(
    `/api/recurring-series/${seriesId}`,
    {
      method: "DELETE",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fromDate,
      }),
    },
    "Recurring block deletion failed.",
  );
}
