import type { MatchState } from '@tutorial/shared'

export const MATCH_STATE_LABELS: Record<MatchState, string | null> = {
  NONE: null,
  REQUESTED: '요청 보냄',
  RECEIVED: '요청 받음',
  ACCEPTED: '같은 반',
}
