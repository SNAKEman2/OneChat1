export function getGetMatchMessagesQueryKey(matchId: string) {
  return [`/api/matches/${matchId}/messages`] as const;
}

export function getGetTodayMatchQueryKey() {
  return [`/api/matches/today`] as const;
}

export function getGetMatchArchiveQueryKey() {
  return [`/api/matches/archive`] as const;
}

export function getGetMyProfileQueryKey() {
  return [`/api/profiles/me`] as const;
}