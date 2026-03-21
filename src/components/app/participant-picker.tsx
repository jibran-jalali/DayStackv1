"use client";

import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";

import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { searchParticipantCandidates } from "@/lib/data/participants";
import { getErrorMessage } from "@/lib/utils";
import type { ParticipantProfile } from "@/types/daystack";

interface ParticipantPickerProps {
  currentUserId: string;
  disabled?: boolean;
  onChange: (participants: ParticipantProfile[]) => void;
  value: ParticipantProfile[];
}

export function ParticipantPicker({
  currentUserId,
  disabled = false,
  onChange,
  value,
}: ParticipantPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParticipantProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const searchIdRef = useRef(0);
  const deferredQuery = useDeferredValue(query);
  const selectedIds = useMemo(() => new Set(value.map((participant) => participant.id)), [value]);

  const runSearch = useEffectEvent(async (term: string) => {
    const searchId = searchIdRef.current + 1;
    searchIdRef.current = searchId;

    setIsLoading(true);
    setError(null);

    try {
      const profiles = await searchParticipantCandidates(term, 6);

      if (searchId !== searchIdRef.current) {
        return;
      }

      setResults(
        profiles.filter((profile) => profile.id !== currentUserId && !selectedIds.has(profile.id)),
      );
    } catch (searchError) {
      if (searchId !== searchIdRef.current) {
        return;
      }

      setResults([]);
      setError(getErrorMessage(searchError));
    } finally {
      if (searchId === searchIdRef.current) {
        setIsLoading(false);
      }
    }
  });

  useEffect(() => {
    if (disabled) {
      setResults([]);
      return;
    }

    void runSearch(deferredQuery);
  }, [deferredQuery, disabled, selectedIds]);

  function handleSelectParticipant(participant: ParticipantProfile) {
    onChange([...value, participant]);
    setQuery("");
  }

  function handleRemoveParticipant(participantId: string) {
    onChange(value.filter((participant) => participant.id !== participantId));
  }

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-foreground/70" />
        <Input
          className="h-11 rounded-[16px] border-border/80 bg-white/96 py-2.5 pl-10 pr-3.5 text-[15px] shadow-none"
          placeholder="Search people to mention"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
        />
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((participant) => (
            <span
              key={participant.id}
              className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/94 px-3 py-1 text-sm text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.04)]"
            >
              {participant.fullName}
              <button
                suppressHydrationWarning
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-secondary-foreground transition hover:bg-muted"
                onClick={() => handleRemoveParticipant(participant.id)}
                disabled={disabled}
                aria-label={`Remove ${participant.fullName}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[18px] border border-border/70 bg-white/75 shadow-[0_8px_18px_rgba(15,23,42,0.03)]">
        {isLoading ? (
          <p className="px-3.5 py-3 text-sm text-secondary-foreground">Searching...</p>
        ) : results.length > 0 ? (
          <div className="divide-y divide-border/70">
            {results.map((participant) => (
              <button
                key={participant.id}
                suppressHydrationWarning
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm transition hover:bg-cyan-50/45"
                onClick={() => handleSelectParticipant(participant)}
                disabled={disabled}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{participant.fullName}</span>
                  {participant.email ? (
                    <span className="block truncate text-xs text-secondary-foreground">{participant.email}</span>
                  ) : null}
                </span>
                <UserPlus className="h-4 w-4 text-secondary-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <p className="px-3.5 py-3 text-sm text-secondary-foreground">
            {error ?? "No people to add yet. Search by name or email."}
          </p>
        )}
      </div>

      {value.length > 0 ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([])} disabled={disabled}>
          Clear participants
        </Button>
      ) : null}
    </div>
  );
}
