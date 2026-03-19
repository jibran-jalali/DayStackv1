interface ErrorPayload {
  error?: string;
  message?: string;
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackMessage: string,
) {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as (T & ErrorPayload) | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error ?? fallbackMessage);
  }

  return payload as T;
}
