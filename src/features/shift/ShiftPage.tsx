import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  color,
  DataTable,
  DataTableHeaderRow,
  DataTableRow,
  GhostButton,
  StatusPill,
  ApiError,
  getBoxesLive,
  listQueueByWashingPoint,
  updateBookingStatus,
  pauseBooking,
  resumeBooking,
  cancelBooking,
  type StatusPillKind,
  type BoardItem,
  type BoardItemStatus,
  type LiveBoxBooking,
} from 'q-wash-shared';
import { Header } from '../../shared/layout/Header';
import { useClock } from '../../shared/useClock';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';
import { BoxCard } from './BoxCard';

const QUEUE_COLUMNS = '0.8fr 1.8fr 1.1fr 1fr 1fr';

// Mirrors q-wash-admin's BookingsPage cadence for this same live-board
// shape — see PLAN.md's "Live updates" decision (poll, not SSE, for v1).
const REFETCH_INTERVAL_MS = 8_000;

function queuePill(status: BoardItemStatus): { kind: StatusPillKind; label: string } {
  return status === 'waiting' ? { kind: 'warn', label: 'Ожидание' } : { kind: 'mute', label: 'В очереди' };
}

function identity(row: BoardItem): string {
  return `${row.car_name ?? 'Авто'} · ••${row.customer_phone_last4}`;
}

function apiErrorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Не удалось выполнить запрос';
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Dushanbe',
});

export function ShiftPage() {
  const washingPointId = useMyWashingPointId();
  const queryClient = useQueryClient();
  const now = useClock();

  // No completed-today count exists anywhere in the API — boxes/live and
  // the today's-queue board both deliberately exclude status=ready rows
  // (see queue.Handler.boxesLive/listByWashingPoint), and admin's stats
  // endpoint is network-wide and admin-only. Tracked client-side for the
  // running session instead of touching the API contract for a badge.
  const [completedCount, setCompletedCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);

  const boxesQuery = useQuery({
    queryKey: ['worker', 'boxes-live', washingPointId],
    queryFn: () => getBoxesLive(washingPointId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
  const queueQuery = useQuery({
    queryKey: ['worker', 'queue', washingPointId],
    queryFn: () => listQueueByWashingPoint(washingPointId),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  function invalidateBoard() {
    void queryClient.invalidateQueries({ queryKey: ['worker', 'boxes-live', washingPointId] });
    void queryClient.invalidateQueries({ queryKey: ['worker', 'queue', washingPointId] });
  }

  // The mock's one-click "Начать мойку" hides a real two-step backend
  // transition (queue -> waiting -> washing, one step at a time — see
  // queue.Manager.UpdateStatus's forwardStatusTransitions). Chained here so
  // the technician still only clicks once.
  const startMutation = useMutation({
    mutationFn: async (booking: { id: string; status: BoardItemStatus }) => {
      if (booking.status === 'queue') {
        await updateBookingStatus(booking.id, 'waiting');
      }
      return updateBookingStatus(booking.id, 'washing');
    },
    onSuccess: invalidateBoard,
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const pauseMutation = useMutation({
    mutationFn: (booking: LiveBoxBooking) => (booking.paused_at ? resumeBooking(booking.id) : pauseBooking(booking.id)),
    onSuccess: invalidateBoard,
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const finishMutation = useMutation({
    mutationFn: (booking: LiveBoxBooking) => updateBookingStatus(booking.id, 'ready'),
    onSuccess: () => {
      setCompletedCount((c) => c + 1);
      invalidateBoard();
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: () => {
      setConfirmingCancelId(null);
      invalidateBoard();
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  function requestCancel(id: string) {
    if (confirmingCancelId === id) {
      cancelMutation.mutate(id);
    } else {
      setConfirmingCancelId(id);
    }
  }

  const boxes = boxesQuery.data?.items ?? [];
  const queueRows = (queueQuery.data?.items ?? [])
    .filter((row) => row.status !== 'washing') // already shown on its box's card
    .sort((a, b) => a.scheduled_start_at.localeCompare(b.scheduled_start_at));

  const startPendingId = startMutation.isPending ? startMutation.variables?.id ?? null : null;
  const actionPendingId = pauseMutation.isPending
    ? (pauseMutation.variables?.id ?? null)
    : finishMutation.isPending
      ? (finishMutation.variables?.id ?? null)
      : null;

  const nextByBoxNumber = new Map(boxes.filter((b) => b.next && !b.current).map((b) => [b.number, b.next!.id]));

  const hadData = boxesQuery.data !== undefined && queueQuery.data !== undefined;
  const isReconnecting = hadData && (boxesQuery.isError || queueQuery.isError);
  const initialError = !hadData && (boxesQuery.isError || queueQuery.isError);

  return (
    <div style={{ minHeight: '100vh', background: color.surface, display: 'flex', flexDirection: 'column' }}>
      <Header completedCount={completedCount} />
      <div style={{ flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {isReconnecting && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              background: 'rgba(217,178,106,.12)',
              border: '1px solid rgba(217,178,106,.4)',
              color: color.warn,
              fontSize: 13,
            }}
          >
            Переподключение… данные на экране могут отставать
          </div>
        )}
        {actionError && (
          <div
            onClick={() => setActionError(null)}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              background: 'rgba(220,90,90,.1)',
              border: `1px solid ${color.bad}`,
              color: color.bad,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {actionError} (нажмите, чтобы скрыть)
          </div>
        )}

        {initialError ? (
          <div style={{ color: color.bad, fontSize: 13 }}>Не удалось загрузить данные мойки. Обновите страницу.</div>
        ) : (
          <>
            <div>
              <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700, marginBottom: 14 }}>Боксы</div>
              {!hadData ? (
                <div style={{ color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                  {boxes.map((box) => (
                    <BoxCard
                      key={box.number}
                      box={box}
                      now={now.getTime()}
                      startPendingId={startPendingId}
                      actionPendingId={actionPendingId}
                      onStart={(booking) => startMutation.mutate(booking)}
                      onPauseToggle={(booking) => pauseMutation.mutate(booking)}
                      onFinish={(booking) => finishMutation.mutate(booking)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700, marginBottom: 14 }}>
                Очередь на сегодня
              </div>
              <DataTable>
                <DataTableHeaderRow
                  gridTemplateColumns={QUEUE_COLUMNS}
                  columns={['Бокс', 'Клиент', 'Время', 'Статус', '']}
                />
                {!hadData ? (
                  <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
                ) : queueRows.length === 0 ? (
                  <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>На сегодня записей больше нет</div>
                ) : (
                  queueRows.map((row, i) => {
                    const pill = queuePill(row.status);
                    const canStart = nextByBoxNumber.get(row.box_number) === row.id;
                    const confirming = confirmingCancelId === row.id;
                    return (
                      <DataTableRow key={row.id} gridTemplateColumns={QUEUE_COLUMNS} isLast={i === queueRows.length - 1}>
                        <div style={{ color: color.textTertiary, fontSize: 13 }}>{row.box_number}</div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              color: color.textPrimaryAlt,
                              fontSize: 13,
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {identity(row)}
                          </div>
                        </div>
                        <div style={{ color: color.textTertiary, fontSize: 13 }}>
                          {timeFormatter.format(new Date(row.scheduled_start_at))}
                        </div>
                        <div>
                          <StatusPill kind={pill.kind}>{pill.label}</StatusPill>
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {canStart && (
                            <GhostButton
                              type="button"
                              disabled={startPendingId === row.id}
                              onClick={() => startMutation.mutate({ id: row.id, status: row.status })}
                              style={{ padding: '6px 12px', fontSize: 11 }}
                            >
                              Начать
                            </GhostButton>
                          )}
                          {confirming && (
                            <GhostButton
                              type="button"
                              onClick={() => setConfirmingCancelId(null)}
                              style={{ padding: '6px 12px', fontSize: 11 }}
                            >
                              Отмена
                            </GhostButton>
                          )}
                          <GhostButton
                            type="button"
                            disabled={cancelMutation.isPending && cancelMutation.variables === row.id}
                            onClick={() => requestCancel(row.id)}
                            style={{ padding: '6px 12px', fontSize: 11, color: color.bad }}
                          >
                            {confirming ? 'Точно снять?' : 'Снять'}
                          </GhostButton>
                        </div>
                      </DataTableRow>
                    );
                  })
                )}
              </DataTable>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
