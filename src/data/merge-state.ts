import type { AppState, Challenge } from '../lib/types'

export function withChallengeIdentity(challenge: Challenge): Challenge & { id: string } {
  return {
    ...challenge,
    id: challenge.id ?? `challenge:${challenge.startDate}`,
  }
}

export function mergePersistedState<T extends AppState>(persisted: unknown, current: T): T {
  if (persisted === null || typeof persisted !== 'object') return current

  const restored = persisted as Partial<AppState>
  if (
    restored.challenge === undefined ||
    typeof restored.challenge.startDate !== 'string' ||
    typeof restored.challenge.totalDays !== 'number'
  ) {
    return current
  }

  return {
    ...current,
    ...restored,
    challenge: withChallengeIdentity(restored.challenge),
  } as T
}
