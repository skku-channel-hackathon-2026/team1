import { useCallback, useEffect, useRef, useState } from 'react'
import { useCallFunction, useWamSize } from '@channel.io/app-sdk-wam'
import {
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
import { Spinner } from './ui'
import './sameClass.css'

type Screen = 'LOADING' | 'INPUT' | 'LIST' | 'OVERLAY'

// Ask Desk for as much room as it will give; it clamps to the available viewport.
// The timetable is the main surface, so every screen wants the full window.
const FULL = { width: 1400, height: 1000 }
const SIZES: Record<Screen, { width: number; height: number }> = {
  LOADING: FULL,
  INPUT: FULL,
  LIST: FULL,
  OVERLAY: FULL,
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

  useEffect(() => {
    setSize(SIZES[screen])
  }, [screen, setSize])

  const runMatch = useCallback(async () => {
    const output = await match.call({})
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
        const { profile: stored } = await getProfile.call({})
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
        const { profile: stored } = await saveProfile.call(input)
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
      const output = await requestMatch.call({ targetId: selectedId })
      setResults((previous) =>
        previous.map((candidate) =>
          candidate.targetId === output.targetId
            ? {
                ...candidate,
                matchState: output.matchState,
                revealedInstances: output.revealedInstances,
              }
            : candidate
        )
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

  if (screen === 'INPUT' || !profile) {
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
          onBack={() => {
            setError(null)
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
