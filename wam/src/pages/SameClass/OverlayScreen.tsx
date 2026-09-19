import {
  DAYS,
  DAY_LABELS,
  PROXIMITY_LABELS,
  type Day,
  type MatchCandidate,
  type Profile,
} from '@tutorial/shared'

import { Legend, TimetableGrid } from './TimetableGrid'
import { MATCH_STATE_LABELS, PROXIMITY_TONE } from './labels'
import { Badge, Button } from './ui'

export interface OverlayScreenProps {
  me: Profile
  candidate: MatchCandidate
  requesting: boolean
  error: string | null
  notice: string | null
  onBack: () => void
  onRequest: () => void
}

const PART_LABELS: { key: keyof MatchCandidate['parts']; label: string }[] = [
  { key: 'sameRoom', label: '같은 강의실' },
  { key: 'sameBuilding', label: '같은 건물' },
  { key: 'free', label: '공강' },
  { key: 'walk', label: '같은 방향 이동' },
]

export function OverlayScreen({
  me,
  candidate,
  requesting,
  error,
  notice,
  onBack,
  onRequest,
}: OverlayScreenProps) {
  const stateLabel = MATCH_STATE_LABELS[candidate.matchState]

  const buttonLabel =
    candidate.matchState === 'NONE'
      ? '같은 반 요청'
      : candidate.matchState === 'REQUESTED'
        ? '요청 보냄 · 수락 대기 중'
        : candidate.matchState === 'RECEIVED'
          ? '요청 수락하기'
          : '같은 반이 됐어요'

  const summaryDays = DAYS.filter(
    (day): day is Day => !!candidate.dailySummary[day]
  )

  return (
    <div className="sc-stack">
      <div className="sc-hero">
        <div>
          <Button
            variant="text"
            size="sm"
            onClick={onBack}
          >
            ← 목록으로
          </Button>
        </div>
        <div className="sc-row sc-row--between sc-row--nowrap">
          <div className="sc-stack sc-stack--tight sc-grow">
            <div className="sc-row">
              <div className="sc-score sc-score--lg">
                <span className="sc-score__value">{candidate.score}</span>
                <span className="sc-score__unit">/ 100</span>
              </div>
              <h1 className="sc-title">{candidate.nickname}</h1>
              <Badge tone="soft">{candidate.department}</Badge>
              <Badge tone={PROXIMITY_TONE[candidate.proximity]}>
                {PROXIMITY_LABELS[candidate.proximity]}
              </Badge>
              {stateLabel && (
                <Badge
                  tone={
                    candidate.matchState === 'ACCEPTED' ? 'success' : 'default'
                  }
                >
                  {stateLabel}
                </Badge>
              )}
            </div>
            <p className="sc-body-sm">{candidate.reasons.join(' · ')}</p>
          </div>
          <Button
            pill
            loading={requesting}
            disabled={
              requesting ||
              candidate.matchState === 'REQUESTED' ||
              candidate.matchState === 'ACCEPTED'
            }
            onClick={onRequest}
          >
            {buttonLabel}
          </Button>
        </div>
      </div>

      <section className="sc-section">
        <TimetableGrid
          key={candidate.targetId}
          mine={me.instances}
          campus={me.campus}
          overlap={candidate.overlapCells}
          animate
        />
        <Legend />
      </section>

      <section className="sc-section">
        <div className="sc-row sc-row--between">
          <h2 className="sc-title-sm">점수는 어떻게 나왔나</h2>
          <span className="sc-caption">내 시간표와 똑같으면 100점</span>
        </div>
        <div className="sc-breakdown">
          {PART_LABELS.map(({ key, label }) => {
            const value = candidate.parts[key]
            const share =
              candidate.score > 0 ? (value / candidate.score) * 100 : 0
            return (
              <div
                key={key}
                className={`sc-breakdown__row${value === 0 ? ' sc-breakdown__row--zero' : ''}`}
              >
                <span className="sc-breakdown__label">{label}</span>
                <span className="sc-breakdown__bar">
                  <span
                    className="sc-breakdown__fill"
                    style={{ width: `${Math.max(share, value > 0 ? 3 : 0)}%` }}
                  />
                </span>
                <span className="sc-breakdown__value">+{value.toFixed(1)}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="sc-section">
        <h2 className="sc-title-sm">함께할 수 있는 하루</h2>
        {summaryDays.length === 0 ? (
          <p className="sc-body-sm sc-muted">겹치는 시간이 없어요.</p>
        ) : (
          <div className="sc-summary">
            {summaryDays.map((day) => (
              <Row
                key={day}
                day={day}
                text={candidate.dailySummary[day] ?? ''}
              />
            ))}
          </div>
        )}
      </section>

      {notice && <p className="sc-notice">{notice}</p>}
      {error && <p className="sc-error">{error}</p>}

      <p className="sc-caption">
        시간표는 위치 정보예요. 같은 반이 된 뒤에도 겹치는 칸만 보여요. 그 칸은
        나도 같은 곳에 있는 시간이라 새로 드러나는 건 없어요. 상대의 단독 일정은
        서버 밖으로 나오지 않아요.
      </p>
    </div>
  )
}

function Row({ day, text }: { day: Day; text: string }) {
  return (
    <>
      <span className="sc-summary__day">{DAY_LABELS[day]}</span>
      <span className="sc-summary__text">{text}</span>
    </>
  )
}
