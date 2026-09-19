import type { MatchState, Proximity } from '@tutorial/shared'

import type { BadgeTone } from './ui'

export const MATCH_STATE_LABELS: Record<MatchState, string | null> = {
  NONE: null,
  REQUESTED: '요청 보냄',
  RECEIVED: '요청 받음',
  ACCEPTED: '같은 반',
}

export const PROXIMITY_TONE: Record<Proximity, BadgeTone> = {
  ROOM: 'ink',
  BUILDING: 'tone-building',
  FREE: 'tone-free',
}
