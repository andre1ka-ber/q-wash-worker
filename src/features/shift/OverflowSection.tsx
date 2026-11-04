import type { CSSProperties } from 'react';
import { color, font, GhostButton, StatusPill, type BoardItem, type QueueDayItem } from 'q-wash-shared';
import { PhotoStrip } from './PhotoStrip';

const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dushanbe' });

export interface OverflowSectionProps {
  rows: BoardItem[];
  details: ReadonlyMap<string, QueueDayItem>;
  startPendingId: string | null;
  actionPendingId: string | null;
  confirmingCancelId: string | null;
  cancelPendingId: string | null;
  onStart: (row: BoardItem) => void;
  onPauseToggle: (row: BoardItem) => void;
  onFinish: (row: BoardItem) => void;
  onCancel: (row: BoardItem) => void;
}

function bigButton(accent: boolean): CSSProperties {
  return {
    flex: 1,
    textAlign: 'center',
    padding: 14,
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font.body,
    background: accent ? color.gold : 'transparent',
    color: accent ? color.goldOnLight : color.textSecondary,
    border: `1px solid ${accent ? color.gold : color.borderDashed}`,
  };
}

function OverflowRow({ row, detail, ...p }: Omit<OverflowSectionProps, 'rows' | 'details'> & { row: BoardItem; detail?: QueueDayItem }) {
  const washing = row.status === 'washing';
  const paused = Boolean(row.paused_at);
  const ticket = detail?.ticket ?? 'O-';
  const car = row.car_name ?? detail?.car_name ?? 'Авто';
  const info = [
    row.status === 'waiting' ? 'на месте' : null,
    timeFormatter.format(new Date(row.scheduled_start_at)),
    detail?.service_name,
  ]
    .filter(Boolean)
    .join(' · ');
  const confirming = p.confirmingCancelId === row.id;
  const busy = p.actionPendingId === row.id;

  return (
    <div
      data-testid={`overflow-${row.id}`}
      style={{
        padding: '12px 14px',
        borderRadius: 16,
        background: washing ? color.panel : color.panel,
        border: `1px dashed ${washing ? (paused ? 'rgba(242,209,75,.45)' : 'rgba(143,203,134,.45)') : '#3A3A34'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 52, flex: '0 0 52px', color: color.gold, fontSize: 17, fontWeight: 700, letterSpacing: '-.03em' }}>{ticket}</div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ color: color.textPrimaryAlt, fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {car} · ••{row.customer_phone_last4}
          </div>
          <div style={{ color: color.textTertiary, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {washing ? [detail?.service_name, detail?.plate].filter(Boolean).join(' · ') || 'Мойка идёт' : info}
          </div>
        </div>
        <StatusPill kind={washing ? (paused ? 'warn' : 'ok') : row.status === 'waiting' ? 'warn' : 'mute'}>
          {washing ? (paused ? 'Пауза' : 'Моется') : row.status === 'waiting' ? 'Ждёт' : 'Подтв.'}
        </StatusPill>
      </div>

      {washing ? (
        <>
          <PhotoStrip bookingId={row.id} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" disabled={busy} onClick={() => p.onPauseToggle(row)} style={bigButton(false)}>
              {paused ? 'Продолжить' : 'Пауза'}
            </button>
            <button type="button" disabled={busy} onClick={() => p.onFinish(row)} style={bigButton(true)}>
              Завершить
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <GhostButton type="button" disabled={p.startPendingId === row.id} onClick={() => p.onStart(row)} style={{ flex: 1, fontSize: 12 }}>
            {p.startPendingId === row.id ? 'Запуск…' : 'Начать мойку'}
          </GhostButton>
          <GhostButton type="button" disabled={p.cancelPendingId === row.id} onClick={() => p.onCancel(row)} style={{ flex: 1, fontSize: 12, color: color.bad }}>
            {confirming ? 'Точно снять?' : 'Снять'}
          </GhostButton>
        </div>
      )}
    </div>
  );
}

// «Вне очереди»: clients added by staff without a free slot. They have no box,
// so they are started, photographed and finished right here, in place — never
// moved to a numbered box. Hidden from customers and the lobby display.
export function OverflowSection({ rows, details, ...p }: OverflowSectionProps) {
  if (rows.length === 0) return null;
  const sorted = rows.slice().sort((a, b) => a.scheduled_start_at.localeCompare(b.scheduled_start_at));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Вне очереди">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ color: color.textPrimary, fontSize: 15, fontWeight: 600 }}>Вне очереди</div>
        <span style={{ padding: '2px 8px', borderRadius: 8, background: 'rgba(242,209,75,.16)', color: color.gold, fontSize: 11.5, fontWeight: 700 }}>
          {rows.length}
        </span>
      </div>
      <div style={{ color: color.textTertiary, fontSize: 11.5, lineHeight: 1.5 }}>
        Клиенты без свободного окна. Не видны клиентам и на экране очереди. Моются на месте.
      </div>
      {sorted.map((row) => (
        <OverflowRow key={row.id} row={row} detail={details.get(row.id)} {...p} />
      ))}
    </div>
  );
}
