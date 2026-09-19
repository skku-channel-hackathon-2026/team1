import { useCallback, useState } from 'react'
import {
  CAMPUS_LABELS,
  DEMO_PRESETS,
  instanceId,
  matchesDemoPreset,
  type Campus,
  type CourseInstance,
  type Day,
  type ProfileInput,
} from '@tutorial/shared'

import { CourseEditor } from './CourseEditor'
import { TimetableGrid } from './TimetableGrid'
import { Badge, Button, Field, Input, Segmented } from './ui'

export interface InputScreenProps {
  draft: ProfileInput
  onChange: (draft: ProfileInput) => void
  onSubmit: (draft: ProfileInput) => void
  submitting: boolean
  error: string | null
  hasSavedProfile: boolean
  onCancel?: () => void
}

type EditorState =
  | { mode: 'add'; initial: CourseInstance }
  | { mode: 'edit'; initial: CourseInstance; original: CourseInstance }

const NEW_COURSE: CourseInstance = {
  subject: '',
  professor: '',
  day: 'MON',
  startPeriod: 2,
  endPeriod: 2,
  room: '',
}

export function InputScreen({
  draft,
  onChange,
  onSubmit,
  submitting,
  error,
  hasSavedProfile,
  onCancel,
}: InputScreenProps) {
  const [editor, setEditor] = useState<EditorState | null>(null)

  const update = useCallback(
    (patch: Partial<ProfileInput>) => onChange({ ...draft, ...patch }),
    [draft, onChange]
  )

  const loadPreset = useCallback(() => {
    const preset = DEMO_PRESETS[draft.campus]
    onChange({
      ...draft,
      department: preset.department,
      instances: preset.instances,
    })
  }, [draft, onChange])

  // Switching campus while the demo timetable is loaded swaps in that campus's demo:
  // different courses, professors and buildings — not just a re-labelled room number.
  const changeCampus = useCallback(
    (campus: Campus) => {
      if (campus === draft.campus) return
      if (matchesDemoPreset(draft.instances, draft.campus)) {
        const preset = DEMO_PRESETS[campus]
        onChange({
          ...draft,
          campus,
          department:
            draft.department === DEMO_PRESETS[draft.campus].department
              ? preset.department
              : draft.department,
          instances: preset.instances,
        })
        return
      }
      onChange({ ...draft, campus })
    },
    [draft, onChange]
  )

  const openAdd = useCallback((day?: Day, period?: number) => {
    setEditor({
      mode: 'add',
      initial: {
        ...NEW_COURSE,
        day: day ?? NEW_COURSE.day,
        startPeriod: period ?? NEW_COURSE.startPeriod,
        endPeriod: period ?? NEW_COURSE.endPeriod,
      },
    })
  }, [])

  const openEdit = useCallback((instance: CourseInstance) => {
    setEditor({ mode: 'edit', initial: instance, original: instance })
  }, [])

  const save = useCallback(
    (next: CourseInstance): string | null => {
      if (!editor) return null
      const originalId =
        editor.mode === 'edit' ? instanceId(editor.original) : null
      const rest = draft.instances.filter(
        (instance) => instanceId(instance) !== originalId
      )
      const nextId = instanceId(next)
      if (rest.some((instance) => instanceId(instance) === nextId)) {
        return '같은 과목·교수·요일·시작 교시의 수업이 이미 있어요'
      }
      const clash = rest.find(
        (instance) =>
          instance.day === next.day &&
          instance.startPeriod <= next.endPeriod &&
          next.startPeriod <= instance.endPeriod
      )
      if (clash) {
        return `${clash.subject}와(과) 시간이 겹쳐요`
      }
      update({ instances: [...rest, next] })
      setEditor(null)
      return null
    },
    [draft.instances, editor, update]
  )

  const remove = useCallback(() => {
    if (!editor || editor.mode !== 'edit') return
    const id = instanceId(editor.original)
    update({
      instances: draft.instances.filter(
        (instance) => instanceId(instance) !== id
      ),
    })
    setEditor(null)
  }, [draft.instances, editor, update])

  const readyToSearch =
    draft.nickname.trim().length > 0 &&
    draft.department.trim().length > 0 &&
    draft.instances.length >= 2

  return (
    <div className="sc-stack">
      <div className="sc-hero">
        <div className="sc-row sc-row--nowrap">
          <img
            className="sc-logo"
            src="./icon-256.png"
            alt=""
            width={44}
            height={44}
          />
          <h1 className="sc-display">대학에도 반이 있었다면</h1>
        </div>
        <p className="sc-body">
          시간표를 넣으면 같은 분반·같은 강의실에 앉는 새내기 중 공강까지 겹치는
          사람을 찾아드려요.
        </p>
      </div>

      <section className="sc-section">
        <div className="sc-row sc-row--between">
          <div className="sc-row">
            <h2 className="sc-title-sm">내 시간표</h2>
            <Badge tone={draft.instances.length >= 2 ? 'ink' : 'soft'}>
              {draft.instances.length}개 수업
            </Badge>
          </div>
          <div className="sc-row">
            <Button
              variant="secondary"
              size="sm"
              pill
              onClick={loadPreset}
            >
              예시 시간표 불러오기
            </Button>
            <Button
              size="sm"
              pill
              onClick={() => openAdd()}
            >
              + 수업 추가
            </Button>
          </div>
        </div>
        <p className="sc-caption">
          빈 칸을 누르면 그 시간에 수업을 추가하고, 수업 블록을 누르면 수정할 수
          있어요.
        </p>
        <TimetableGrid
          mine={draft.instances}
          campus={draft.campus}
          onSelectInstance={openEdit}
          onSelectEmpty={openAdd}
        />
      </section>

      <section className="sc-section">
        <h2 className="sc-title-sm">내 정보</h2>
        <div className="sc-form-row">
          <Field label="닉네임 (실명 아님)">
            <Input
              placeholder="다른 사람에게 보일 이름"
              value={draft.nickname}
              maxLength={20}
              onChange={(event) => update({ nickname: event.target.value })}
            />
          </Field>
          <Field label="학과">
            <Input
              placeholder="예: 경영학과"
              value={draft.department}
              maxLength={30}
              onChange={(event) => update({ department: event.target.value })}
            />
          </Field>
        </div>
        <Segmented<Campus>
          label="캠퍼스"
          value={draft.campus}
          options={(Object.keys(CAMPUS_LABELS) as Campus[]).map((campus) => ({
            value: campus,
            label: CAMPUS_LABELS[campus],
          }))}
          onChange={changeCampus}
        />
      </section>

      {error && <p className="sc-error">{error}</p>}

      <div className="sc-stack sc-stack--tight">
        <div className="sc-row">
          <Button
            block
            disabled={!readyToSearch || submitting}
            loading={submitting}
            onClick={() => onSubmit(draft)}
          >
            {hasSavedProfile ? '시간표 저장하고 다시 찾기' : '같은 반 찾기'}
          </Button>
        </div>
        {hasSavedProfile && onCancel && (
          <Button
            variant="text"
            onClick={onCancel}
          >
            취소하고 목록으로
          </Button>
        )}
        {!readyToSearch && (
          <p
            className="sc-caption"
            style={{ textAlign: 'center' }}
          >
            닉네임·학과를 적고 과목을 2개 이상 넣으면 찾을 수 있어요.
          </p>
        )}
      </div>

      {editor && (
        <CourseEditor
          mode={editor.mode}
          campus={draft.campus}
          initial={editor.initial}
          onSave={save}
          onDelete={editor.mode === 'edit' ? remove : undefined}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  )
}
