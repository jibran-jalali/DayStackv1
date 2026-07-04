import type { ParticipantProfile } from "@/types/daystack";

export async function searchParticipantCandidates(query: string, limit = 6): Promise<ParticipantProfile[]> {
  const searchParams = new URLSearchParams();

  if (query.trim().length > 0) {
    searchParams.set("q", query.trim());
  }

  searchParams.set("limit", `${limit}`);

  const response = await fetch(`/api/participants/search?${searchParams.toString()}`, {
    method: "GET",
    credentials: "same-origin",
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
        results?: ParticipantProfile[];
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Participant search failed.");
  }

  return payload?.results ?? [];
}
