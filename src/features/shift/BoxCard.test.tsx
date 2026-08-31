import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveBox, LiveBoxBooking } from 'q-wash-shared';
import { BoxCard } from './BoxCard';

const START = '2026-08-31T10:00:00.000Z';
const END = '2026-08-31T10:30:00.000Z';
const NOW_2M05S_IN = new Date(START).getTime() + 125_000;

function booking(overrides: Partial<LiveBoxBooking> = {}): LiveBoxBooking {
  return {
    id: 'booking-1',
    status: 'washing',
    service_name: 'Комплекс',
    scheduled_start_at: START,
    scheduled_end_at: END,
    customer_phone_last4: '1234',
    car_name: 'Camry',
    ...overrides,
  };
}

function box(overrides: Partial<LiveBox> = {}): LiveBox {
  return { number: 3, is_open: true, ...overrides };
}

const noop = () => vi.fn();

describe('BoxCard badge + elapsed rendering', () => {
  it('shows "В работе" and the elapsed/total time for an active, unpaused booking', () => {
    render(
      <BoxCard
        box={box({ current: booking() })}
        now={NOW_2M05S_IN}
        startPendingId={null}
        actionPendingId={null}
        onStart={noop()}
        onPauseToggle={noop()}
        onFinish={noop()}
      />,
    );
    expect(screen.getByText('В работе')).toBeInTheDocument();
    expect(screen.getByText('02:05 из 30 мин')).toBeInTheDocument();
  });

  it('shows "Пауза" for an active booking with paused_at set, freezing elapsed at the pause point', () => {
    const pausedAt = new Date(new Date(START).getTime() + 60_000).toISOString();
    render(
      <BoxCard
        box={box({ current: booking({ paused_at: pausedAt }) })}
        now={NOW_2M05S_IN}
        startPendingId={null}
        actionPendingId={null}
        onStart={noop()}
        onPauseToggle={noop()}
        onFinish={noop()}
      />,
    );
    expect(screen.getByText('Пауза')).toBeInTheDocument();
    expect(screen.getByText('01:00 из 30 мин')).toBeInTheDocument();
  });

  it('shows "Закрыт" when the box has no current booking and is not open', () => {
    render(
      <BoxCard
        box={box({ is_open: false })}
        now={NOW_2M05S_IN}
        startPendingId={null}
        actionPendingId={null}
        onStart={noop()}
        onPauseToggle={noop()}
        onFinish={noop()}
      />,
    );
    expect(screen.getByText('Закрыт')).toBeInTheDocument();
    expect(screen.getByText('На сегодня записей нет')).toBeInTheDocument();
  });

  it('shows "В работе" (not "Закрыт") when a box mid-wash is administratively closed — busy state wins', () => {
    render(
      <BoxCard
        box={box({ is_open: false, current: booking() })}
        now={NOW_2M05S_IN}
        startPendingId={null}
        actionPendingId={null}
        onStart={noop()}
        onPauseToggle={noop()}
        onFinish={noop()}
      />,
    );
    expect(screen.getByText('В работе')).toBeInTheDocument();
  });

  it('shows "Свободен" and the next booking\'s start button when idle with an upcoming booking', () => {
    render(
      <BoxCard
        box={box({ next: booking({ id: 'booking-2' }) })}
        now={NOW_2M05S_IN}
        startPendingId={null}
        actionPendingId={null}
        onStart={noop()}
        onPauseToggle={noop()}
        onFinish={noop()}
      />,
    );
    expect(screen.getByText('Свободен')).toBeInTheDocument();
    expect(screen.getByText('Начать мойку')).toBeInTheDocument();
  });

  it('shows "Запуск…" and disables the button while the next booking is starting', () => {
    render(
      <BoxCard
        box={box({ next: booking({ id: 'booking-2' }) })}
        now={NOW_2M05S_IN}
        startPendingId="booking-2"
        actionPendingId={null}
        onStart={noop()}
        onPauseToggle={noop()}
        onFinish={noop()}
      />,
    );
    const startButton = screen.getByRole('button', { name: 'Запуск…' });
    expect(startButton).toBeDisabled();
  });

  it('shows the empty state when there is no current or next booking', () => {
    render(
      <BoxCard
        box={box()}
        now={NOW_2M05S_IN}
        startPendingId={null}
        actionPendingId={null}
        onStart={noop()}
        onPauseToggle={noop()}
        onFinish={noop()}
      />,
    );
    expect(screen.getByText('На сегодня записей нет')).toBeInTheDocument();
  });
});
