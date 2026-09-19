// Local-only stand-in for the Desk host (`window.ChannelIOWam`).
// Loaded by main.tsx in `vite` dev mode when the real host is absent, so the WAM can run at
// http://localhost:5173 without Desk. Functions are served in the browser with the shared
// algorithm and a localStorage-backed copy of the server store. Never bundled for production.
//
// Query params: ?member=m2 (act as another manager), ?appearance=dark, ?reset=1 (clear store)

import type { CallFunctionArgs, WamSize } from '@channel.io/app-sdk-wam'
import {
  ProfileInputSchema,
  SEED_PROFILES,
  TUTORIAL_FUNCTIONS,
  isSeedMember,
  rankMatches,
  type MatchCandidate,
  type MatchState,
  type Profile,
} from '@tutorial/shared'

const STORE_KEY = 'same-class:local-host'
const APP_ID = 'local-app'
const CHANNEL_ID = 'local-channel'

interface MatchRecord {
  pair: [string, string]
  requestedBy: string[]
  acceptedAt?: string
}

interface Store {
  profiles: Record<string, Profile>
  matches: Record<string, MatchRecord>
}

const query = new URLSearchParams(window.location.search)
const managerId = query.get('member') ?? 'local-manager'
const appearance = query.get('appearance') === 'dark' ? 'dark' : 'light'

function readStore(): Store {
  if (query.get('reset')) window.localStorage.removeItem(STORE_KEY)
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as Store
  } catch {
    // fall through
  }
  return { profiles: {}, matches: {} }
}

function writeStore(store: Store) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join('|')
}

function deriveState(
  record: MatchRecord | undefined,
  me: string,
  other: string
): MatchState {
  if (!record) return 'NONE'
  const mine = record.requestedBy.includes(me)
  const theirs = record.requestedBy.includes(other)
  if (mine && theirs) return 'ACCEPTED'
  if (mine) return 'REQUESTED'
  if (theirs) return 'RECEIVED'
  return 'NONE'
}

function pool(store: Store): Profile[] {
  const byId = new Map<string, Profile>()
  for (const seed of SEED_PROFILES) byId.set(seed.memberId, seed)
  for (const profile of Object.values(store.profiles)) {
    byId.set(profile.memberId, profile)
  }
  return [...byId.values()]
}

const delay = () => new Promise((resolve) => setTimeout(resolve, 120))

async function callFunction<T>({ name, params }: CallFunctionArgs): Promise<T> {
  await delay()
  const store = readStore()
  const me = store.profiles[managerId] ?? null

  switch (name) {
    case TUTORIAL_FUNCTIONS.getProfile:
      return { profile: me } as T

    case TUTORIAL_FUNCTIONS.saveProfile: {
      const input = ProfileInputSchema.parse(params)
      const profile: Profile = {
        ...input,
        memberId: managerId,
        updatedAt: new Date().toISOString(),
      }
      store.profiles[managerId] = profile
      writeStore(store)
      return { profile } as T
    }

    case TUTORIAL_FUNCTIONS.deleteProfile: {
      delete store.profiles[managerId]
      for (const key of Object.keys(store.matches)) {
        if (store.matches[key].pair.includes(managerId))
          delete store.matches[key]
      }
      writeStore(store)
      return {} as T
    }

    case TUTORIAL_FUNCTIONS.match: {
      if (!me) return { me: null, poolSize: 0, results: [] } as T
      const everyone = pool(store)
      const results: MatchCandidate[] = rankMatches(me, everyone).map(
        (result) => {
          const record = store.matches[pairKey(managerId, result.targetId)]
          return {
            ...result,
            matchState: deriveState(record, managerId, result.targetId),
            isSeed: isSeedMember(result.targetId),
          }
        }
      )
      return { me, poolSize: everyone.length, results } as T
    }

    case TUTORIAL_FUNCTIONS.requestMatch: {
      const targetId = String(params.targetId ?? '')
      if (!me) throw new Error('Save your timetable before requesting a match')
      if (targetId === managerId) throw new Error('You cannot request yourself')
      const target = pool(store).find((p) => p.memberId === targetId)
      if (!target || target.campus !== me.campus) {
        throw new Error('The target is not in your candidate pool')
      }
      const key = pairKey(managerId, targetId)
      const existing = store.matches[key]
      const requestedBy = new Set(existing?.requestedBy ?? [])
      requestedBy.add(managerId)
      if (isSeedMember(targetId)) requestedBy.add(targetId)
      const record: MatchRecord = {
        pair: [managerId, targetId].sort() as [string, string],
        requestedBy: [...requestedBy],
        acceptedAt:
          existing?.acceptedAt ??
          (requestedBy.has(targetId) ? new Date().toISOString() : undefined),
      }
      store.matches[key] = record
      writeStore(store)
      const matchState = deriveState(record, managerId, targetId)
      const notified = !isSeedMember(targetId)
      if (notified) {
        console.info(
          `[같은 반] (로컬) ${target.nickname}에게 DM: ` +
            (matchState === 'ACCEPTED'
              ? `${me.nickname}님과 같은 반이 됐어요!`
              : `${me.nickname}님이 같은 반 요청을 보냈어요.`)
        )
      }
      return { targetId, matchState, notified } as T
    }

    default:
      throw new Error(`Local host does not implement ${name}`)
  }
}

const wamData: Record<string, unknown> = {
  appId: APP_ID,
  channelId: CHANNEL_ID,
  managerId,
  chatId: 'local-group',
  chatType: 'group',
  chatTitle: '로컬 개발',
  broadcast: false,
  message: 'local',
  appearance,
}

window.ChannelIOWam = {
  getWamData: (key: string) => wamData[key],
  setSize: (size: WamSize) => {
    // Mimic the Desk window so layout can be judged at the requested size.
    const root = document.getElementById('root')
    if (!root) return
    // Desk clamps to its viewport; do the same so a large request fills the browser window.
    root.style.width = size.width ? `min(${size.width}px, 100vw)` : ''
    root.style.height = `min(${size.height}px, 100vh)`
    root.style.margin = '0 auto'
    root.style.overflow = 'hidden'
  },
  callFunction,
  callNativeFunction: async () => {
    throw new Error('Native functions are unavailable outside Desk')
  },
  close: () => window.alert('Desk에서는 창이 닫힙니다.'),
}

if (appearance === 'dark') document.body.style.backgroundColor = '#464748'
console.info(
  `[같은 반] Desk 없이 로컬 호스트로 실행 중 — member=${managerId}. ` +
    '?member=m2 로 다른 사용자, ?appearance=dark 로 다크 테마, ?reset=1 로 초기화.'
)
