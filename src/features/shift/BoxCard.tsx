import type { CSSProperties } from 'react';
import {
  color,
  font,
  radius,
  GhostButton,
  PrimaryButton,
  StatusPill,
  type StatusPillKind,
  type LiveBox,
  type LiveBoxBooking,
  type QueueDayItem,
} from 'q-wash-shared';
import { PhotoStrip } from './PhotoStrip';

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
  // Ticket/plate/client/class come from the day list, keyed by booking id —
  // boxes/live itself carries none of them.
  details?: ReadonlyMap<string, QueueDayItem>;
  mobile?: boolean;
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dushanbe' });

function mobileBadgePill(kind: StatusPillKind): CSSProperties {
  const palette: Record<StatusPillKind, CSSProperties> = {
    ok: { background: color.okBg, color: color.ok },
    warn: { background: color.warnBg, color: color.warn },
    bad: { background: color.badBg, color: color.bad },
    mute: { background: color.muteBg, color: color.mute },
  };
  return {
    display: 'inline-block',
    padding: '4px 9px',
    borderRadius: 9,
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    ...palette[kind],
  };
}

function mobileButton(accent: boolean): CSSProperties {
  return {
    flex: 1,
    textAlign: 'center',
    padding: 16,
    borderRadius: 15,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.body,
    background: accent ? color.gold : 'transparent',
    color: accent ? color.goldOnLight : color.textSecondary,
    border: `1px solid ${accent ? color.gold : color.borderDashed}`,
  };
}

function MobileBoxCard({ box, now, startPendingId, actionPendingId, onStart, onPauseToggle, onFinish, details }: BoxCardProps) {
  const current = box.current;
  const next = box.next;
  const badge = badgeFor(box);
  const shown = current ?? next;
  const detail = shown ? details?.get(shown.id) : undefined;
  const paused = Boolean(current?.paused_at);
  const elapsedMin = current ? Math.floor(Math.max(0, elapsedMs(current, now)) / 60000) : 0;
  const totalMin = current ? Math.round(durationMs(current) / 60000) : 0;
  const progressPct = current ? Math.min(100, (elapsedMs(current, now) / durationMs(current)) * 100) : 0;
  const borderColor = current ? (paused ? 'rgba(242,209,75,.34)' : 'rgba(143,203,134,.3)') : color.borderAlt;

  const stateText = current
    ? `Бокс ${box.number} · ${paused ? 'на паузе' : 'мойка идёт'}`
    : `Бокс ${box.number} · ${box.is_open ? 'готов принять авто' : 'закрыт'}`;
  const secondLine = [detail?.plate, detail?.client_name].filter(Boolean).join(' · ') || `••${shown?.customer_phone_last4 ?? ''}`;
  const slot = shown
    ? [timeFormatter.format(new Date(shown.scheduled_start_at)), detail?.price_option_name].filter(Boolean).join(' · ')
    : '';

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 22,
        background: color.panel,
        border: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: color.textSecondary, fontSize: 13, fontWeight: 600 }}>{stateText}</div>
        <span style={mobileBadgePill(badge.kind)}>{badge.label}</span>
      </div>

      {current ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '6px 0' }}>
            {detail?.ticket && (
              <div style={{ color: color.gold, fontSize: 64, fontWeight: 700, letterSpacing: '-.05em', lineHeight: 1 }}>
                {detail.ticket}
              </div>
            )}
            <div style={{ color: color.textPrimary, fontSize: 16, fontWeight: 600 }}>{current.car_name ?? 'Авто'}</div>
            <div style={{ color: color.textTertiary, fontSize: 13 }}>{secondLine}</div>
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: color.panelAlt,
              border: `1px solid ${color.borderAlt}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ color: color.textTertiary, fontSize: 12.5 }}>Услуга</span>
              <span style={{ color: color.textPrimaryAlt, fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>
                {current.service_name ?? 'Услуга'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ color: color.textTertiary, fontSize: 12.5 }}>Слот / класс</span>
              <span style={{ color: color.textPrimaryAlt, fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>{slot}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ color: color.textTertiary, fontSize: 12.5 }}>
                {paused ? 'Пауза на' : 'Идёт'} {elapsedMin} мин из {totalMin}
              </span>
              <span style={{ color: color.textPrimary, fontSize: 18, fontWeight: 700 }}>{elapsedMin} мин</span>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: color.borderAlt, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  borderRadius: 6,
                  transition: 'width .4s',
                  background: paused ? color.gold : color.ok,
                }}
              />
            </div>
          </div>

          <PhotoStrip bookingId={current.id} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              disabled={actionPendingId === current.id}
              onClick={() => onPauseToggle(current)}
              style={mobileButton(false)}
            >
              {paused ? 'Продолжить' : 'Пауза'}
            </button>
            <button
              type="button"
              disabled={actionPendingId === current.id}
              onClick={() => onFinish(current)}
              style={mobileButton(true)}
            >
              Завершить
            </button>
          </div>
        </div>
      ) : next ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0' }}>
            <div style={{ color: color.textTertiary, fontSize: 12.5 }}>Следующий по записи</div>
            {detail?.ticket && (
              <div style={{ color: color.gold, fontSize: 52, fontWeight: 700, letterSpacing: '-.05em', lineHeight: 1 }}>
                {detail.ticket}
              </div>
            )}
            <div style={{ color: color.textPrimary, fontSize: 15, fontWeight: 600 }}>{next.car_name ?? 'Авто'}</div>
            <div style={{ color: color.textTertiary, fontSize: 12.5, textAlign: 'center' }}>
              {[next.service_name, slot].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button
            type="button"
            disabled={startPendingId === next.id}
            onClick={() => onStart(next)}
            style={{ ...mobileButton(true), flex: 'none' }}
          >
            {startPendingId === next.id ? 'Запуск…' : `Начать мойку${detail?.ticket ? ` ${detail.ticket}` : ''}`}
          </button>
        </div>
      ) : (
        <div style={{ color: color.textFaint, fontSize: 13, padding: '8px 0' }}>На сегодня записей нет</div>
      )}
    </div>
  );
}

export function BoxCard(props: BoxCardProps) {
  return props.mobile ? <MobileBoxCard {...props} /> : <DesktopBoxCard {...props} />;
}

function DesktopBoxCard({ box, now, startPendingId, actionPendingId, onStart, onPauseToggle, onFinish }: BoxCardProps) {
  const current = box.current;
  const next = box.next;
  const badge = badgeFor(box);
  const progressPct = current ? Math.min(100, (elapsedMs(current, now) / durationMs(current)) * 100) : 0;

  return (
    <div
      style={{
        borderRadius: 22,
        background: color.panel,
        border: `1px solid ${color.border}`,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        minHeight: 340,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: color.textPrimary, fontSize: 17, fontWeight: 700 }}>
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

          <PhotoStrip bookingId={current.id} />

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
