import type { Notification, NotificationKind } from '@tutorial/shared'

import { Badge, Button } from './ui'
import type { BadgeTone } from './ui'

export interface InboxPanelProps {
  notifications: Notification[]
  onOpen: (fromId: string) => void
  onMarkAllRead: () => void
  onClose: () => void
}

const KIND_LABELS: Record<NotificationKind, string> = {
  REQUEST: '요청',
  ACCEPTED: '같은 반',
  CANCELLED: '취소',
  MESSAGE: '메시지',
}

const KIND_TONES: Record<NotificationKind, BadgeTone> = {
  REQUEST: 'tint',
  ACCEPTED: 'success',
  CANCELLED: 'soft',
  MESSAGE: 'ink',
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

export function InboxPanel({
  notifications,
  onOpen,
  onMarkAllRead,
  onClose,
}: InboxPanelProps) {
  const unread = notifications.filter((entry) => !entry.read).length
  return (
    <div
      className="sc-modal-scrim"
      onClick={onClose}
    >
      <div
        className="sc-modal sc-modal--inbox"
        role="dialog"
        aria-modal="true"
        aria-label="알림"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sc-row sc-row--between">
          <h2 className="sc-title">알림</h2>
          <div className="sc-row">
            {unread > 0 && (
              <Button
                variant="text"
                size="sm"
                onClick={onMarkAllRead}
              >
                모두 읽음
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              닫기
            </Button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <p className="sc-body-sm sc-muted">아직 알림이 없어요.</p>
        ) : (
          <div className="sc-list">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`sc-notif${notification.read ? '' : ' sc-notif--unread'}`}
                onClick={() => onOpen(notification.fromId)}
              >
                <span className="sc-row">
                  <Badge tone={KIND_TONES[notification.kind]}>
                    {KIND_LABELS[notification.kind]}
                  </Badge>
                  <span className="sc-strong">{notification.fromNickname}</span>
                  <span className="sc-caption">
                    {formatWhen(notification.createdAt)}
                  </span>
                </span>
                <span className="sc-body-sm">{notification.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
