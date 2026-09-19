// Everytime-style weekly timetable: hour rows, day columns, time-positioned colored blocks.
// Used three ways: personal editor (click blocks / empty slots), overlay (match highlights),
// and a tiny thumbnail on candidate cards. The overlay never shows the other person's solo
// classes — only cells where we are in the same room, the same building, or both free.
import { useMemo, type CSSProperties } from 'react'
import {
  DAYS,
  DAY_LABELS,
  MAX_PERIOD,
  PERIOD_TIMES,
  buildSlotGrid,
  buildingName,
  courseKey,
  instanceId,
  type Campus,
  type CourseInstance,
  type Day,
  type OverlapCell,
} from '@tutorial/shared'

export interface TimetableGridProps {
  mine: CourseInstance[]
  campus: Campus
  /** Overlap cells from a MatchResult — turns the grid into the overlay view. */
  overlap?: OverlapCell[]
  mini?: boolean
  animate?: boolean
  /** Editor mode: click one of my blocks. */
  onSelectInstance?: (instance: CourseInstance) => void
  /** Editor mode: click an empty slot to add a class there. */
  onSelectEmpty?: (day: Day, period: number) => void
}

const START_HOUR = 9
const MIN_END_HOUR = 18
const HOUR_HEIGHT = 52
const MINI_HOUR_HEIGHT = 6
const ANIMATION_TOTAL_MS = 400

// Everytime's block palette (white text on every swatch).
const PALETTE = [
  '#e57373',
  '#f0935e',
  '#c9a227',
  '#7cb342',
  '#26a69a',
  '#4f9ee8',
  '#7986cb',
  '#ba68c8',
  '#ec6f9c',
  '#8d6e63',
]

function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function periodStart(period: number) {
  return minutes(PERIOD_TIMES[period].start)
}

function periodEnd(period: number) {
  return minutes(PERIOD_TIMES[period].end)
}

function hashColor(key: string): string {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

type BlockTone = 'mine' | 'same' | 'building'

interface Block {
  key: string
  day: Day
  top: number
  height: number
  tone: BlockTone
  color?: string
  title: string
  meta: string
  order: number
  instance: CourseInstance
}

interface FreeArea {
  key: string
  day: Day
  top: number
  height: number
  label: string
  order: number
}

export function TimetableGrid({
  mine,
  campus,
  overlap,
  mini = false,
  animate = false,
  onSelectInstance,
  onSelectEmpty,
}: TimetableGridProps) {
  const hourHeight = mini ? MINI_HOUR_HEIGHT : HOUR_HEIGHT
  const editable = !mini && !overlap && (onSelectInstance || onSelectEmpty)

  const model = useMemo(() => {
    const overlapByKey = new Map<string, OverlapCell>()
    for (const cell of overlap ?? []) {
      overlapByKey.set(`${cell.day}:${cell.period}`, cell)
    }
    const latestEnd = Math.max(
      MIN_END_HOUR * 60,
      ...mine.map((instance) => periodEnd(instance.endPeriod))
    )
    const endHour = Math.ceil(latestEnd / 60)
    const toY = (minute: number) =>
      ((minute - START_HOUR * 60) / 60) * hourHeight

    let order = 0
    const blocks: Block[] = []
    const frees: FreeArea[] = []
    const myGrid = buildSlotGrid(mine)

    for (const instance of mine) {
      const cells: OverlapCell[] = []
      for (let p = instance.startPeriod; p <= instance.endPeriod; p++) {
        const hit = overlapByKey.get(`${instance.day}:${p}`)
        if (hit) cells.push(hit)
      }
      const same = cells.some((cell) => cell.kind === 'SAME')
      const building = !same && cells.some((cell) => cell.kind === 'BUILDING')
      const tone: BlockTone = same ? 'same' : building ? 'building' : 'mine'
      const lit = tone !== 'mine'
      blocks.push({
        key: instanceId(instance),
        day: instance.day,
        top: toY(periodStart(instance.startPeriod)),
        height:
          toY(periodEnd(instance.endPeriod)) -
          toY(periodStart(instance.startPeriod)),
        tone,
        color: overlap ? undefined : hashColor(courseKey(instance)),
        title: instance.subject,
        meta: `${instance.professor} · ${buildingName(campus, instance.room)} ${instance.room}`,
        order: lit ? order++ : -1,
        instance,
      })
    }

    for (const cell of overlap ?? []) {
      if (cell.kind !== 'FREE') continue
      frees.push({
        key: `free:${cell.day}:${cell.period}`,
        day: cell.day,
        top: toY(periodStart(cell.period)),
        height: toY(periodEnd(cell.period)) - toY(periodStart(cell.period)),
        label: cell.label,
        order: order++,
      })
    }

    // Empty-slot click targets for the editor.
    const slots: { day: Day; period: number; top: number; height: number }[] =
      []
    if (editable && onSelectEmpty) {
      for (const day of DAYS) {
        for (let p = 1; p <= MAX_PERIOD; p++) {
          if (periodEnd(p) > endHour * 60) break
          if (myGrid[day][p].kind === 'CLASS') continue
          slots.push({
            day,
            period: p,
            top: toY(periodStart(p)),
            height: toY(periodEnd(p)) - toY(periodStart(p)),
          })
        }
      }
    }

    const hours = Array.from(
      { length: endHour - START_HOUR },
      (_, index) => START_HOUR + index
    )
    return { blocks, frees, slots, hours, litCount: order }
  }, [mine, overlap, campus, hourHeight, editable, onSelectEmpty])

  const bodyHeight = model.hours.length * hourHeight
  const delayFor = (order: number) =>
    animate && order >= 0 && model.litCount > 1
      ? (order / (model.litCount - 1)) * ANIMATION_TOTAL_MS
      : 0

  return (
    <div
      className={`et${mini ? ' et--mini' : ''}${overlap ? ' et--overlay' : ''}`}
      role="table"
      aria-label="주간 시간표"
    >
      {!mini && (
        <div className="et-head">
          <div className="et-gutter" />
          {DAYS.map((day) => (
            <div
              key={day}
              className="et-head__day"
            >
              {DAY_LABELS[day]}
            </div>
          ))}
        </div>
      )}
      <div
        className="et-body"
        style={{ height: bodyHeight }}
      >
        {!mini && (
          <div className="et-gutter et-gutter--body">
            {model.hours.map((hour) => (
              <div
                key={hour}
                className="et-hour"
                style={{ height: hourHeight }}
              >
                {hour}
              </div>
            ))}
          </div>
        )}
        {DAYS.map((day) => (
          <div
            key={day}
            className="et-col"
          >
            {model.hours.map((hour) => (
              <div
                key={hour}
                className="et-line"
                style={{ top: (hour - START_HOUR) * hourHeight }}
              />
            ))}
            {model.slots
              .filter((slot) => slot.day === day)
              .map((slot) => (
                <button
                  key={slot.period}
                  type="button"
                  className="et-slot"
                  style={{ top: slot.top, height: slot.height }}
                  aria-label={`${DAY_LABELS[day]}요일 ${slot.period}교시에 수업 추가`}
                  onClick={() => onSelectEmpty?.(day, slot.period)}
                >
                  <span className="et-slot__plus">+</span>
                </button>
              ))}
            {model.frees
              .filter((free) => free.day === day)
              .map((free) => (
                <div
                  key={free.key}
                  className={`et-free${animate ? ' et--lit' : ''}`}
                  style={{
                    top: free.top,
                    height: free.height,
                    animationDelay: `${delayFor(free.order)}ms`,
                  }}
                >
                  {!mini && free.label}
                </div>
              ))}
            {model.blocks
              .filter((block) => block.day === day)
              .map((block) => {
                const style: CSSProperties = {
                  top: block.top,
                  height: block.height,
                  animationDelay: `${delayFor(block.order)}ms`,
                }
                if (block.color) style.background = block.color
                const classes = ['et-block', `et-block--${block.tone}`]
                if (animate && block.order >= 0) classes.push('et--lit')
                const clickable = editable && onSelectInstance
                if (clickable) classes.push('et-block--clickable')
                // The thumbnail is color-only; text would overlap at 6px per hour.
                const content = mini ? null : (
                  <>
                    <span className="et-block__title">{block.title}</span>
                    <span className="et-block__meta">{block.meta}</span>
                  </>
                )
                return clickable ? (
                  <button
                    key={block.key}
                    type="button"
                    className={classes.join(' ')}
                    style={style}
                    onClick={() => onSelectInstance?.(block.instance)}
                    title="눌러서 수정"
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={block.key}
                    className={classes.join(' ')}
                    style={style}
                    title={mini ? block.title : undefined}
                  >
                    {content}
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Legend() {
  return (
    <div className="sc-legend">
      <span>
        <span className="sc-legend__swatch et-block--mine" />내 수업
      </span>
      <span>
        <span className="sc-legend__swatch et-block--same" />
        같은 강의실
      </span>
      <span>
        <span className="sc-legend__swatch et-block--building" />
        같은 건물 · 다른 강의실
      </span>
      <span>
        <span className="sc-legend__swatch et-free" />
        공강
      </span>
    </div>
  )
}
