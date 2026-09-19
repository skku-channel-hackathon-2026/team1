import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CHAT_TEXT_MAX, type ChatMessage } from '@tutorial/shared'

import { Button } from './ui'

export interface ChatPanelProps {
  me: string
  peerNickname: string
  messages: ChatMessage[]
  sending: boolean
  error: string | null
  onSend: (text: string) => void
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function ChatPanel({
  me,
  peerNickname,
  messages,
  sending,
  error,
  onSend,
}: ChatPanelProps) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages.length])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || sending) return
    onSend(trimmed.slice(0, CHAT_TEXT_MAX))
    setText('')
  }

  return (
    <section className="sc-section">
      <div className="sc-row sc-row--between">
        <h2 className="sc-title-sm">{peerNickname}님과의 대화</h2>
        <span className="sc-caption">같은 반이 된 사이에만 열려요</span>
      </div>

      <div
        className="sc-chat"
        ref={listRef}
      >
        {messages.length === 0 ? (
          <p className="sc-chat__empty">
            첫 메시지를 보내보세요. 다음 수업 어디서 만날지 정하기 좋아요.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`sc-bubble${message.senderId === me ? ' sc-bubble--mine' : ''}`}
            >
              <span className="sc-bubble__text">{message.text}</span>
              <span className="sc-bubble__time">
                {formatTime(message.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>

      <form
        className="sc-chat__form"
        onSubmit={submit}
      >
        <input
          className="sc-input"
          placeholder="메시지를 입력하세요"
          value={text}
          maxLength={CHAT_TEXT_MAX}
          onChange={(event) => setText(event.target.value)}
        />
        <Button
          type="submit"
          disabled={sending || text.trim().length === 0}
        >
          보내기
        </Button>
      </form>
      {error && <p className="sc-error">{error}</p>}
    </section>
  )
}
