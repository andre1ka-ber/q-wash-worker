import { color, font, radius, GhostButton, PrimaryButton, StatusPill, type StatusPillKind, type LiveBox, type LiveBoxBooking } from 'q-wash-shared';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// No "elapsed since wash started" field exists on the backend — only
// scheduled_start_at/scheduled_end_at and paused_at. Elapsed is derived as
// wall-clock time since the scheduled start, frozen at whatever it was when
// paused_at was set (paused_at doesn't move while paused, so this naturally
// stops ticking, and naturally resumes counting real elapsed time — not a
// simulated one — the moment paused_at is cleared).
function elapsedMs(booking: LiveBoxBooking, now: number): number {
  const anchor = booking.paused_at ? new Date(booking.paused_at).getTime() : now;
  return anchor - new Date(booking.scheduled_start_at).getTime();
}

function durationMs(booking: LiveBoxBooking): number {
  return new Date(booking.scheduled_end_at).getTime() - new Date(booking.scheduled_start_at).getTime();
}

function identity(booking: LiveBoxBooking): string {
  return `${booking.car_name ?? 'Авто'} · ••${booking.customer_phone_last4}`;
}

interface BadgeInfo {
  kind: StatusPillKind;
  label: string;
}

// A box mid-wash when it gets administratively closed (q-wash-cabinet's
// Боксы tab) still needs its busy state shown first — that's the more
// urgent signal for whoever's standing at it. Otherwise, closed (same
// StatusPill convention BoxesPage.tsx already uses: bad/"Закрыт") beats
// the generic "Свободен", since an idle closed box would otherwise look
// identical to an idle open one and invite a walk-in nobody approved.
function badgeFor(box: LiveBox): BadgeInfo {
  if (box.current) {
    return box.current.paused_at ? { kind: 'warn', label: 'Пауза' } : { kind: 'ok', label: 'В работе' };
  }
  if (!box.is_open) return { kind: 'bad', label: 'Закрыт' };
  return { kind: 'mute', label: 'Свободен' };
}

export interface BoxCardProps {
  box: LiveBox;
  now: number;
  startPendingId: string | null;
  actionPendingId: string | null;
  onStart: (booking: LiveBoxBooking) => void;
  onPauseToggle: (booking: LiveBoxBooking) => void;
  onFinish: (booking: LiveBoxBooking) => void;
}

export function BoxCard({ box, now, startPendingId, actionPendingId, onStart, onPauseToggle, onFinish }: BoxCardProps) {
  const current = box.current;
  const next = box.next;
  const badge = badgeFor(box);
  const progressPct = current ? Math.min(100, (elapsedMs(current, now) / durationMs(current)) * 100) : 0;

  return (
    <div
      style={{
        borderRadius: radius.xxxl,
        background: color.panel,
        border: `1px solid ${color.border}`,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: font.display, color: color.textPrimary, fontSize: 17 }}>
          Бокс {box.number}
          {box.label ? ` · ${box.label}` : ''}
        </div>
        <StatusPill kind={badge.kind}>{badge.label}</StatusPill>
      </div>

      {current ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ color: color.textPrimaryAlt, fontSize: 15, fontWeight: 600 }}>{identity(current)}</div>
            <div style={{ color: color.textMuted, fontSize: 12 }}>
              {current.service_name ?? 'Услуга'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                height: 6,
                borderRadius: radius.pill,
                background: color.input,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  borderRadius: radius.pill,
                  background: current.paused_at ? color.warn : color.gold,
                  transition: 'width 1s linear',
                }}
              />
            </div>
            <div style={{ color: color.textFaint, fontSize: 11 }}>
              {formatElapsed(elapsedMs(current, now))} из {Math.round(durationMs(current) / 60000)} мин
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <GhostButton
              type="button"
              disabled={actionPendingId === current.id}
              onClick={() => onPauseToggle(current)}
              style={{ flex: 1, fontSize: 12 }}
            >
              {current.paused_at ? 'Продолжить' : 'Пауза'}
            </GhostButton>
            <PrimaryButton
              type="button"
              disabled={actionPendingId === current.id}
              onClick={() => onFinish(current)}
              style={{ flex: 1, fontSize: 12 }}
            >
              Завершить
            </PrimaryButton>
          </div>
        </>
      ) : next ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ color: color.textPrimaryAlt, fontSize: 15, fontWeight: 600 }}>{identity(next)}</div>
            <div style={{ color: color.textMuted, fontSize: 12 }}>{next.service_name ?? 'Услуга'}</div>
          </div>
          <PrimaryButton
            type="button"
            disabled={startPendingId === next.id}
            onClick={() => onStart(next)}
            style={{ fontSize: 12 }}
          >
            {startPendingId === next.id ? 'Запуск…' : 'Начать мойку'}
          </PrimaryButton>
        </>
      ) : (
        <div style={{ color: color.textFaint, fontSize: 13, padding: '8px 0' }}>На сегодня записей нет</div>
      )}
    </div>
  );
}
