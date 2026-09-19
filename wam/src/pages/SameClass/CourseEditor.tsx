import { useEffect, useState } from 'react'
import {
  CourseInstanceSchema,
  DAYS,
  DAY_LABELS,
  MAX_PERIOD,
  PERIOD_TIMES,
  buildingName,
  type Campus,
  type CourseInstance,
  type Day,
} from '@tutorial/shared'

import { Button, Field, Input } from './ui'

export interface CourseEditorProps {
  mode: 'add' | 'edit'
  campus: Campus
  initial: CourseInstance
  /** Returns an error message to show, or null when saved. */
  onSave: (instance: CourseInstance) => string | null
  onDelete?: () => void
  onClose: () => void
}

const PERIODS = Array.from({ length: MAX_PERIOD }, (_, index) => index + 1)

export function CourseEditor({
  mode,
  campus,
  initial,
  onSave,
  onDelete,
  onClose,
}: CourseEditorProps) {
  const [form, setForm] = useState<CourseInstance>(initial)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    const parsed = CourseInstanceSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력을 다시 확인해주세요')
      return
    }
    const problem = onSave(parsed.data)
    if (problem) setError(problem)
  }

  return (
    <div
      className="sc-modal-scrim"
      onClick={onClose}
    >
      <div
        className="sc-modal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'add' ? '수업 추가' : '수업 수정'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sc-row sc-row--between">
          <h2 className="sc-title">
            {mode === 'add' ? '수업 추가' : '수업 수정'}
          </h2>
          <span className="sc-caption">
            {DAY_LABELS[form.day]} {PERIOD_TIMES[form.startPeriod].start}–
            {PERIOD_TIMES[form.endPeriod].end}
          </span>
        </div>

        <Field label="과목명">
          <Input
            autoFocus
            placeholder="예: 경영학원론"
            value={form.subject}
            maxLength={40}
            onChange={(event) =>
              setForm({ ...form, subject: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') save()
            }}
          />
        </Field>
        <Field label="교수">
          <Input
            placeholder="예: 김예진"
            value={form.professor}
            maxLength={30}
            onChange={(event) =>
              setForm({ ...form, professor: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') save()
            }}
          />
        </Field>
        <div className="sc-form-row sc-form-row--3">
          <Field label="요일">
            <select
              className="sc-select"
              value={form.day}
              onChange={(event) =>
                setForm({ ...form, day: event.target.value as Day })
              }
            >
              {DAYS.map((day) => (
                <option
                  key={day}
                  value={day}
                >
                  {DAY_LABELS[day]}요일
                </option>
              ))}
            </select>
          </Field>
          <Field label="시작">
            <select
              className="sc-select"
              value={form.startPeriod}
              onChange={(event) => {
                const start = Number(event.target.value)
                setForm({
                  ...form,
                  startPeriod: start,
                  endPeriod: Math.max(start, form.endPeriod),
                })
              }}
            >
              {PERIODS.map((period) => (
                <option
                  key={period}
                  value={period}
                >
                  {period}교시 · {PERIOD_TIMES[period].start}
                </option>
              ))}
            </select>
          </Field>
          <Field label="종료">
            <select
              className="sc-select"
              value={form.endPeriod}
              onChange={(event) =>
                setForm({ ...form, endPeriod: Number(event.target.value) })
              }
            >
              {PERIODS.filter((period) => period >= form.startPeriod).map(
                (period) => (
                  <option
                    key={period}
                    value={period}
                  >
                    {period}교시 · {PERIOD_TIMES[period].end}
                  </option>
                )
              )}
            </select>
          </Field>
        </div>
        <Field label="강의실 번호 (5자리)">
          <Input
            placeholder="예: 31207"
            value={form.room}
            maxLength={5}
            inputMode="numeric"
            onChange={(event) =>
              setForm({ ...form, room: event.target.value.replace(/\D/g, '') })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') save()
            }}
          />
        </Field>
        {form.room.length === 5 && (
          <p className="sc-caption">
            {buildingName(campus, form.room)} {form.room.charAt(2)}층
          </p>
        )}
        {error && <p className="sc-error">{error}</p>}

        <div className="sc-row sc-row--between">
          <div>
            {mode === 'edit' && onDelete && (
              <Button
                variant="text"
                danger
                onClick={onDelete}
              >
                이 수업 삭제
              </Button>
            )}
          </div>
          <div className="sc-row">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              취소
            </Button>
            <Button onClick={save}>{mode === 'add' ? '추가' : '저장'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
