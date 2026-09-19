import { useCallback, useEffect, useRef, useState } from 'react'
import { useCallFunction, useWamSize } from '@channel.io/app-sdk-wam'
import {
  GetProfileOutputSchema,
  MatchOutputSchema,
  RequestMatchOutputSchema,
  SaveProfileOutputSchema,
  TUTORIAL_FUNCTIONS,
  type GetProfileOutput,
  type MatchCandidate,
  type MatchOutput,
  type Profile,
  type ProfileInput,
  type RequestMatchOutput,
  type SaveProfileOutput,
} from '@tutorial/shared'

import { useTutorialWamData } from '../../hooks/useTutorialWamData'
import { InputScreen } from './InputScreen'
import { ListScreen } from './ListScreen'
import { OverlayScreen } from './OverlayScreen'
import { Button, Spinner } from './ui'
import './sameClass.css'

type Screen = 'LOADING' | 'INPUT' | 'LIST' | 'OVERLAY'

// Desk does NOT clamp an oversized request — it builds the window we ask for and the
// overflow ends up off-screen with no way to scroll to it. So derive the request from the
// monitor and stay well inside it. Caps keep the window sane on very large displays.
const MIN_SIZE = { width: 640, height: 460 }
const MAX_SIZE = { width: 1080, height: 720 }

function preferredSize(): { width: number; height: number } {
  const screen = typeof window === 'undefined' ? undefined : window.screen
  const availWidth = screen?.availWidth || 1280
  const availHeight = screen?.availHeight || 800
  const clamp = (value: number, min: number, max: number) =>
    Math.round(Math.min(Math.max(value, min), max))
  return {
    // Desk's own chrome and the chat list take the left half of the screen.
    width: clamp(availWidth * 0.55, MIN_SIZE.width, MAX_SIZE.width),
    height: clamp(availHeight * 0.62, MIN_SIZE.height, MAX_SIZE.height),
  }
}

const EMPTY_DRAFT: ProfileInput = {
  nickname: '',
  department: '',
  campus: 'HUMANITIES',
  includeOtherDepartments: false,
  instances: [],
}

function draftKey(channelId: string, managerId: string) {
  return `same-class:draft:${channelId}:${managerId}`
}

function readDraft(key: string): ProfileInput | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as ProfileInput) : null
  } catch {
    return null
  }
}

function writeDraft(key: string, draft: ProfileInput) {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // localStorage is a convenience only.
  }
}

function toInput(profile: Profile): ProfileInput {
  return {
    nickname: profile.nickname,
    department: profile.department,
    campus: profile.campus,
    includeOtherDepartments: profile.includeOtherDepartments,
    instances: profile.instances,
  }
}

/** Structural stand-in for a Zod schema so the WAM does not need zod as a direct dependency. */
interface ResultSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false }
}

/**
 * Validate a Function result before using it.
 * The host normally returns the result directly, but a wrapped envelope would otherwise
 * leave every field undefined and the screen silently unchanged. Unwrap one layer, then
 * fail loudly with the raw payload so the cause is visible instead of invisible.
 */
function readResult<T>(schema: ResultSchema<T>, raw: unknown, what: string): T {
  const candidates: unknown[] = [raw]
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>
    for (const key of ['result', 'data', 'output']) {
      if (record[key] !== undefined) candidates.push(record[key])
    }
  }
  for (const candidate of candidates) {
    const parsed = schema.safeParse(candidate)
    if (parsed.success) return parsed.data
  }
  console.error(`[같은 반] unexpected ${what} response`, raw)
  throw new Error(
    `${what} 응답을 이해하지 못했어요: ${JSON.stringify(raw ?? null).slice(0, 180)}`
  )
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message)
    return `${fallback} (${error.message})`
  return fallback
}

export function SameClassApp() {
  const { setSize } = useWamSize()
  const { data: wamData, error: wamDataError } = useTutorialWamData()
  const appId = wamData?.appId ?? ''
  const channelId = wamData?.channelId ?? ''
  const managerId = wamData?.managerId ?? ''

  const [screen, setScreen] = useState<Screen>('LOADING')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [draft, setDraft] = useState<ProfileInput>(EMPTY_DRAFT)
  const [results, setResults] = useState<MatchCandidate[]>([])
  const [poolSize, setPoolSize] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const getProfile = useCallFunction<GetProfileOutput>({
    appId,
    name: TUTORIAL_FUNCTIONS.getProfile,
  })
  const saveProfile = useCallFunction<SaveProfileOutput>({
    appId,
    name: TUTORIAL_FUNCTIONS.saveProfile,
  })
  const deleteProfile = useCallFunction<Record<string, never>>({
    appId,
    name: TUTORIAL_FUNCTIONS.deleteProfile,
  })
  const match = useCallFunction<MatchOutput>({
    appId,
    name: TUTORIAL_FUNCTIONS.match,
  })
  const requestMatch = useCallFunction<RequestMatchOutput>({
    appId,
    name: TUTORIAL_FUNCTIONS.requestMatch,
  })

  // One size for every screen: re-requesting on each transition makes Desk jump.
  useEffect(() => {
    setSize(preferredSize())
  }, [setSize])

  const runMatch = useCallback(async () => {
    const output = readResult(MatchOutputSchema, await match.call({}), '추천')
    setResults(output.results)
    setPoolSize(output.poolSize)
    if (output.me) setProfile(output.me)
    return output
  }, [match])

  // Boot once the host has handed over appId/channelId/managerId.
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current || !appId || !channelId || !managerId) return
    booted.current = true
    void (async () => {
      try {
        const { profile: stored } = readResult(
          GetProfileOutputSchema,
          await getProfile.call({}),
          '프로필'
        )
        if (stored) {
          setProfile(stored)
          setDraft(toInput(stored))
          await runMatch()
          setScreen('LIST')
        } else {
          setDraft(readDraft(draftKey(channelId, managerId)) ?? EMPTY_DRAFT)
          setScreen('INPUT')
        }
      } catch (caught) {
        setError(
          describeError(caught, '프로필을 불러오지 못했어요. 다시 열어보세요.')
        )
        setScreen('INPUT')
      }
    })()
  }, [appId, channelId, managerId, getProfile, runMatch])

  const handleDraftChange = useCallback(
    (next: ProfileInput) => {
      setDraft(next)
      if (channelId && managerId)
        writeDraft(draftKey(channelId, managerId), next)
    },
    [channelId, managerId]
  )

  const handleSubmit = useCallback(
    async (input: ProfileInput) => {
      setBusy(true)
      setError(null)
      try {
        const { profile: stored } = readResult(
          SaveProfileOutputSchema,
          await saveProfile.call(input),
          '시간표 저장'
        )
        setProfile(stored)
        await runMatch()
        setScreen('LIST')
      } catch (caught) {
        setError(
          describeError(
            caught,
            '시간표를 저장하지 못했어요. 입력을 확인하고 다시 시도해주세요.'
          )
        )
      } finally {
        setBusy(false)
      }
    },
    [runMatch, saveProfile]
  )

  const handleRefresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await runMatch()
    } catch (caught) {
      setError(describeError(caught, '추천을 새로 불러오지 못했어요.'))
    } finally {
      setBusy(false)
    }
  }, [runMatch])

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        '내 시간표를 지우면 모든 상대의 추천에서 사라져요. 지울까요?'
      )
    )
      return
    setBusy(true)
    setError(null)
    try {
      await deleteProfile.call({})
      setProfile(null)
      setResults([])
      setDraft(EMPTY_DRAFT)
      if (channelId && managerId) {
        try {
          window.localStorage.removeItem(draftKey(channelId, managerId))
        } catch {
          // ignore
        }
      }
      setScreen('INPUT')
    } catch (caught) {
      setError(describeError(caught, '시간표를 지우지 못했어요.'))
    } finally {
      setBusy(false)
    }
  }, [channelId, deleteProfile, managerId])

  const handleScopeChange = useCallback(
    async (includeOtherDepartments: boolean) => {
      if (!profile) return
      const next = { ...profile, includeOtherDepartments }
      setProfile(next)
      try {
        await saveProfile.call(toInput(next))
      } catch {
        // The toggle still works in memory; persistence is best effort.
      }
    },
    [profile, saveProfile]
  )

  const handleRequest = useCallback(async () => {
    if (!selectedId) return
    setBusy(true)
    setError(null)
    try {
      const output = readResult(
        RequestMatchOutputSchema,
        await requestMatch.call({ targetId: selectedId }),
        '같은 반 요청'
      )
      setResults((previous) =>
        previous.map((candidate) =>
          candidate.targetId === output.targetId
            ? { ...candidate, matchState: output.matchState }
            : candidate
        )
      )
      setNotice(
        output.notified
          ? output.matchState === 'ACCEPTED'
            ? '같은 반이 됐어요! 상대에게 다이렉트 메시지를 보냈어요.'
            : '요청을 보냈어요. 상대에게 다이렉트 메시지로 알렸어요.'
          : output.matchState === 'ACCEPTED'
            ? '같은 반이 됐어요!'
            : '요청을 보냈어요. 상대가 수락하면 같은 반이 돼요.'
      )
    } catch (caught) {
      setError(describeError(caught, '요청을 보내지 못했어요.'))
    } finally {
      setBusy(false)
    }
  }, [requestMatch, selectedId])

  if (wamDataError) {
    return (
      <div className="sc-root">
        <p className="sc-error">
          Desk가 앱 정보를 전달하지 않았어요. 커맨드를 닫고 다시 실행해주세요.
        </p>
      </div>
    )
  }

  if (screen === 'LOADING') {
    return (
      <div className="sc-root">
        <Spinner text="같은 반을 찾을 준비를 하고 있어요…" />
      </div>
    )
  }

  if (screen === 'INPUT') {
    return (
      <div className="sc-root">
        <InputScreen
          draft={draft}
          onChange={handleDraftChange}
          onSubmit={(input) => void handleSubmit(input)}
          submitting={busy}
          error={error}
          hasSavedProfile={!!profile}
          onCancel={profile ? () => setScreen('LIST') : undefined}
        />
      </div>
    )
  }

  // Past the input screen the profile must exist. If it does not, say so instead of
  // bouncing back to the form with no explanation.
  if (!profile) {
    return (
      <div className="sc-root">
        <p className="sc-error">
          {error ??
            '시간표를 저장했지만 프로필을 받지 못했어요. 다시 시도해주세요.'}
        </p>
        <div className="sc-row">
          <Button onClick={() => setScreen('INPUT')}>
            시간표 입력으로 돌아가기
          </Button>
        </div>
      </div>
    )
  }

  const selected = results.find(
    (candidate) => candidate.targetId === selectedId
  )

  if (screen === 'OVERLAY' && selected) {
    return (
      <div className="sc-root">
        <OverlayScreen
          me={profile}
          candidate={selected}
          requesting={busy}
          error={error}
          notice={notice}
          onBack={() => {
            setError(null)
            setNotice(null)
            setScreen('LIST')
          }}
          onRequest={() => void handleRequest()}
        />
      </div>
    )
  }

  return (
    <div className="sc-root">
      {error && <p className="sc-error">{error}</p>}
      <ListScreen
        me={profile}
        results={results}
        poolSize={poolSize}
        loading={busy}
        onSelect={(candidate) => {
          setSelectedId(candidate.targetId)
          setError(null)
          setNotice(null)
          setScreen('OVERLAY')
        }}
        onEdit={() => {
          setDraft(toInput(profile))
          setError(null)
          setScreen('INPUT')
        }}
        onRefresh={() => void handleRefresh()}
        onDelete={() => void handleDelete()}
        onScopeChange={(value) => void handleScopeChange(value)}
      />
    </div>
  )
}
