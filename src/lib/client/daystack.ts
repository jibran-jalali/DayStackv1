import type { DashboardSnapshot, TaskFormValues, TaskPropagationMode, TaskRecord } from "@/types/daystack";

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
      }),
    },
    "Task reschedule failed.",
  );

  return payload.task;
}

export async function deleteTask(taskId: string): Promise<string> {
  const payload = await requestJson<{ taskDate: string }>(
    `/api/tasks/${taskId}`,
    {
      method: "DELETE",
      credentials: "same-origin",
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
