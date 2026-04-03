import type {
  AssistantChatRequest,
  AssistantModelResponse,
  AssistantMutationAction,
  AssistantContext,
} from "@/types/assistant";

import { requestJson } from "@/lib/client/request";

export async function sendAssistantMessage(payload: AssistantChatRequest): Promise<AssistantModelResponse> {
  return requestJson<AssistantModelResponse>(
    "/api/assistant/chat",
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Assistant request failed.",
  );
}

export async function confirmAssistantAction(payload: {
  action: AssistantMutationAction;
  context: AssistantContext;
}): Promise<{ message: string; recommendedDate: string }> {
  return requestJson<{ message: string; recommendedDate: string }>(
    "/api/assistant/execute",
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Assistant action failed.",
  );
}
