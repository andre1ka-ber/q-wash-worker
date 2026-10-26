import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LiveBox, LiveBoxBooking, QueueDayItem } from 'q-wash-shared';
import { BoxCard } from './BoxCard';

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return { ...actual, listBookingPhotos: () => Promise.resolve({ items: [] }) };
});

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

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

  it('mobile: shows the big ticket, plate, client and class for the washing booking', () => {
    const details = new Map<string, QueueDayItem>([
      [
        'booking-1',
        {
          id: 'booking-1',
          status: 'washing',
          ticket: 'A-14',
          box_number: 3,
          scheduled_start_at: START,
          scheduled_end_at: END,
          source: 'manual',
          car_name: 'Camry',
          plate: '4321 AB 01',
          client_name: 'Далер Р.',
          client_phone: '+992000000000',
          service_name: 'Комплекс',
          price_option_name: 'Седан',
          price_cents: 0,
          items: [],
        },
      ],
    ]);
    render(
      <BoxCard
        mobile
        details={details}
        box={box({ current: booking() })}
        now={NOW_2M05S_IN}
        startPendingId={null}
        actionPendingId={null}
        onStart={noop()}
        onPauseToggle={noop()}
        onFinish={noop()}
      />,
    );
    expect(screen.getByText('A-14')).toBeInTheDocument();
    expect(screen.getByText('4321 AB 01 · Далер Р.')).toBeInTheDocument();
    expect(screen.getByText('Бокс 3 · мойка идёт')).toBeInTheDocument();
    expect(screen.getByText('Идёт 2 мин из 30')).toBeInTheDocument();
    expect(screen.getByText('Фото')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Завершить' })).toBeInTheDocument();
  });

  it('mobile: free box shows the next booking and a start button', () => {
    render(
      <BoxCard
        mobile
        box={box({ next: booking({ id: 'booking-2', status: 'queue' }) })}
        now={NOW_2M05S_IN}
        startPendingId={null}
        actionPendingId={null}
        onStart={noop()}
        onPauseToggle={noop()}
        onFinish={noop()}
      />,
    );
    expect(screen.getByText('Следующий по записи')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Начать мойку' })).toBeInTheDocument();
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
