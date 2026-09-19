import { useMemo, useState } from 'react'
import {
  PROXIMITY_LABELS,
  type MatchCandidate,
  type Profile,
  type Proximity,
} from '@tutorial/shared'

import { TimetableGrid } from './TimetableGrid'
import { MATCH_STATE_LABELS, PROXIMITY_TONE } from './labels'
import { Badge, Button, Segmented, Switch } from './ui'

export interface ListScreenProps {
  me: Profile
  results: MatchCandidate[]
  poolSize: number
  loading: boolean
  onSelect: (candidate: MatchCandidate) => void
  onEdit: () => void
  onRefresh: () => void
  onDelete: () => void
  onScopeChange: (includeOtherDepartments: boolean) => void
}

type SortKey = 'score' | 'sameRoom' | 'free'
type ProximityFilter = 'ALL' | Proximity

export function ListScreen({
  me,
  results,
  poolSize,
  loading,
  onSelect,
  onEdit,
  onRefresh,
  onDelete,
  onScopeChange,
}: ListScreenProps) {
  const [sort, setSort] = useState<SortKey>('score')
  const [proximity, setProximity] = useState<ProximityFilter>('ALL')
  const includeOthers = me.includeOtherDepartments

  const filtered = useMemo(() => {
    const list = results.filter((candidate) => {
      if (!includeOthers && candidate.department !== me.department) return false
      if (proximity !== 'ALL' && candidate.proximity !== proximity) return false
      return true
    })
    const compare: Record<
      SortKey,
      (a: MatchCandidate, b: MatchCandidate) => number
    > = {
      score: (a, b) => b.score - a.score,
      sameRoom: (a, b) =>
        b.sameRoom.length - a.sameRoom.length || b.score - a.score,
      free: (a, b) =>
        b.sharedFreeSlots.length - a.sharedFreeSlots.length ||
        b.score - a.score,
    }
    return [...list].sort(compare[sort])
  }, [results, includeOthers, me.department, proximity, sort])

  const topId = filtered[0]?.targetId

  return (
    <div className="sc-stack">
      <div className="sc-hero">
        <div className="sc-row sc-row--between sc-row--nowrap">
          <h1 className="sc-title">당신과 같은 반이 될 수 있는 사람</h1>
          <Badge tone="primary">{filtered.length}명</Badge>
        </div>
        <p className="sc-body-sm">
          <span className="sc-strong">{me.nickname}</span> · {me.department} ·
          이 채널에 시간표를 올린 {poolSize}명 중에서 찾았어요
        </p>
        <div className="sc-row">
          <Button
            variant="secondary"
            size="sm"
            pill
            onClick={onEdit}
          >
            시간표 수정
          </Button>
          <Button
            variant="secondary"
            size="sm"
            pill
            loading={loading}
            onClick={onRefresh}
          >
            새로고침
          </Button>
          <Button
            variant="text"
            size="sm"
            danger
            onClick={onDelete}
          >
            내 시간표 지우기
          </Button>
        </div>
      </div>

      <section className="sc-section">
        <div className="sc-row">
          <span className="sc-filter-label">정렬</span>
          <Segmented<SortKey>
            label="정렬"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'score', label: '추천순' },
              { value: 'sameRoom', label: '같은 수업 많은 순' },
              { value: 'free', label: '공강 겹침 많은 순' },
            ]}
          />
        </div>
        <div className="sc-row">
          <span className="sc-filter-label">근접</span>
          <Segmented<ProximityFilter>
            label="근접 등급"
            value={proximity}
            onChange={setProximity}
            options={[
              { value: 'ALL', label: '전체' },
              { value: 'ROOM', label: '같은 강의실' },
              { value: 'BUILDING', label: '같은 건물' },
            ]}
          />
        </div>
        <div className="sc-row">
          <Switch
            checked={includeOthers}
            onChange={onScopeChange}
            label="타 학과 포함"
          />
          <span className="sc-body-sm sc-strong">
            {includeOthers ? '타 학과 포함' : '우리 학과만'}
          </span>
          <span className="sc-caption">
            타 학과는 주로 교양 수업으로 겹쳐요
          </span>
        </div>
      </section>

      {results.length === 0 && (
        <p className="sc-body-sm sc-muted">
          같은 인스턴스가 한 개도 없어요. 과목을 더 넣어보세요.
        </p>
      )}
      {results.length > 0 && filtered.length === 0 && (
        <p className="sc-body-sm sc-muted">
          이 조건에 맞는 사람이 없어요. 필터를 바꿔보세요.
        </p>
      )}

      <div className="sc-list">
        {filtered.map((candidate) => (
          <CandidateCard
            key={candidate.targetId}
            me={me}
            candidate={candidate}
            top={candidate.targetId === topId && sort === 'score'}
            showDepartment={includeOthers}
            onClick={() => onSelect(candidate)}
          />
        ))}
      </div>
    </div>
  )
}

function CandidateCard({
  me,
  candidate,
  top,
  showDepartment,
  onClick,
}: {
  me: Profile
  candidate: MatchCandidate
  top: boolean
  showDepartment: boolean
  onClick: () => void
}) {
  const stateLabel = MATCH_STATE_LABELS[candidate.matchState]
  return (
    <div
      className={`sc-card${top ? ' sc-card--top' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <div
        className="sc-row sc-row--nowrap"
        style={{ alignItems: 'flex-start', gap: 16 }}
      >
        <div className="sc-grow sc-stack sc-stack--tight">
          <div className="sc-row">
            <span className="sc-title-sm">{candidate.nickname}</span>
            {showDepartment && candidate.department !== me.department && (
              <span className="sc-caption">{candidate.department}</span>
            )}
            {top && <Badge tone="primary">1순위</Badge>}
            <Badge tone={PROXIMITY_TONE[candidate.proximity]}>
              {PROXIMITY_LABELS[candidate.proximity]}
            </Badge>
            {stateLabel && (
              <Badge
                tone={candidate.matchState === 'ACCEPTED' ? 'success' : 'soft'}
              >
                {stateLabel}
              </Badge>
            )}
          </div>
          <div
            className="sc-stack"
            style={{ gap: 4 }}
          >
            {candidate.reasons.map((reason) => (
              <div
                key={reason}
                className="sc-reason"
              >
                {reason}
              </div>
            ))}
          </div>
        </div>
        <div className="sc-card__side">
          <div className="sc-score">
            <span className="sc-score__value">{candidate.score}</span>
            <span className="sc-score__unit">점</span>
          </div>
          <TimetableGrid
            mine={me.instances}
            campus={me.campus}
            overlap={candidate.overlapCells}
            mini
          />
        </div>
      </div>
    </div>
  )
}
