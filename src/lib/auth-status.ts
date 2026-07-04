export interface DisabledStatusSource {
  status?: string | null;
  banned_until?: string | null;
}

export function isUserDisabled(user: DisabledStatusSource | null | undefined) {
  if (user?.status === "disabled") {
    return true;
  }

  if (!user?.banned_until) {
    return false;
  }

  const bannedUntil = Date.parse(user.banned_until);

  return Number.isFinite(bannedUntil) && bannedUntil > Date.now();
}
