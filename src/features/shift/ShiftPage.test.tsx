import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type BoardItem, type LiveBox, type LiveBoxBooking, type User } from 'q-wash-shared';
import { ShiftPage } from './ShiftPage';

const getBoxesLive = vi.fn();
const listQueueByWashingPoint = vi.fn();
const updateBookingStatus = vi.fn();
const pauseBooking = vi.fn();
const resumeBooking = vi.fn();
const cancelBooking = vi.fn();
let mobile = false;

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    useIsMobile: () => mobile,
    getWashingPoint: () => Promise.resolve({ id: 'wp-1', name: 'Pegasus', address: 'ул. Рудаки, 84' }),
    getBoxesLive: (...a: unknown[]) => getBoxesLive(...a),
    listQueueByWashingPoint: (...a: unknown[]) => listQueueByWashingPoint(...a),
    updateBookingStatus: (...a: unknown[]) => updateBookingStatus(...a),
    pauseBooking: (...a: unknown[]) => pauseBooking(...a),
    resumeBooking: (...a: unknown[]) => resumeBooking(...a),
    cancelBooking: (...a: unknown[]) => cancelBooking(...a),
  };
});

const fakeUser: User = { id: 'u1', phone_number: '+992000000000', name: 'Мастер', role: 'worker', washing_point_id: 'wp-1', last_login_at: null };

const START = '2026-09-26T05:00:00.000Z';
const END = '2026-09-26T05:30:00.000Z';

function row(over: Partial<BoardItem> = {}): BoardItem {
  return { id: 'q1', status: 'queue', box_number: 1, scheduled_start_at: START, scheduled_end_at: END, customer_phone_last4: '4567', car_name: 'Camry', ...over };
}

const liveBooking = (id: string, over: Partial<LiveBoxBooking> = {}): LiveBoxBooking => ({
  id, status: 'queue', service_name: 'Экспресс', scheduled_start_at: START, scheduled_end_at: END, customer_phone_last4: '4567', car_name: 'Camry', ...over,
});

function setBoard(boxes: LiveBox[], queue: BoardItem[]) {
  getBoxesLive.mockResolvedValue({ items: boxes });
  listQueueByWashingPoint.mockResolvedValue({ items: queue });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ShiftPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mobile = false;
  updateBookingStatus.mockResolvedValue({});
  pauseBooking.mockResolvedValue({});
  resumeBooking.mockResolvedValue({});
  cancelBooking.mockResolvedValue({});
  setBoard([{ number: 1, is_open: true, next: liveBooking('q1') }], [row()]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ShiftPage — queue table', () => {
  it('lists today\'s bookings, leaving out the one already washing (it is on its box card)', async () => {
    setBoard(
      [{ number: 1, is_open: true, current: liveBooking('w1', { status: 'washing' }) }],
      [row({ id: 'w1', status: 'washing', car_name: 'Washing Car' }), row({ id: 'q2', car_name: 'Waiting Car', status: 'waiting', customer_phone_last4: '9999' })],
    );
    renderPage();

    const table = await screen.findByText(/Waiting Car/);
    expect(table).toBeInTheDocument();
    expect(screen.getByText('Ожидание')).toBeInTheDocument();
    // "Washing Car" shows on the box card ("Camry" there), never as a queue row
    expect(screen.queryByText(/Washing Car/)).not.toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    setBoard([{ number: 1, is_open: true }], []);
    renderPage();
    expect(await screen.findByText('На сегодня записей больше нет')).toBeInTheDocument();
  });

  it('shows a full-page error when the first load fails', async () => {
    getBoxesLive.mockRejectedValue(new Error('down'));
    listQueueByWashingPoint.mockRejectedValue(new Error('down'));
    renderPage();
    expect(await screen.findByText(/Не удалось загрузить данные мойки/)).toBeInTheDocument();
  });
});

describe('ShiftPage — starting a wash', () => {
  it('a queued booking goes queue -> waiting -> washing in one click, in that order', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Начать' }));

    await waitFor(() => expect(updateBookingStatus).toHaveBeenCalledTimes(2));
    expect(updateBookingStatus.mock.calls).toEqual([
      ['q1', 'waiting'],
      ['q1', 'washing'],
    ]);
  });

  it('an already-arrived booking only needs the washing step', async () => {
    setBoard([{ number: 1, is_open: true, next: liveBooking('q1', { status: 'waiting' }) }], [row({ status: 'waiting' })]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Начать' }));

    await waitFor(() => expect(updateBookingStatus).toHaveBeenCalledTimes(1));
    expect(updateBookingStatus).toHaveBeenCalledWith('q1', 'washing');
  });

  it('only the next booking of a free box can be started from the table', async () => {
    setBoard(
      [{ number: 1, is_open: true, next: liveBooking('q1') }],
      [row({ id: 'q1' }), row({ id: 'q2', customer_phone_last4: '2222', scheduled_start_at: '2026-09-26T06:00:00.000Z' })],
    );
    renderPage();
    await screen.findByText(/••2222/);
    // one "Начать" in the table (q1) + the box card's own "Начать мойку" — never one for q2
    expect(screen.getAllByRole('button', { name: 'Начать' })).toHaveLength(1);
  });

  it('a box that is already washing offers no Начать for its waiting bookings', async () => {
    setBoard(
      [{ number: 1, is_open: true, current: liveBooking('w1', { status: 'washing' }), next: liveBooking('q1') }],
      [row({ id: 'w1', status: 'washing' }), row({ id: 'q1' })],
    );
    renderPage();
    await screen.findAllByText(/••4567/);
    expect(screen.queryByRole('button', { name: 'Начать' })).not.toBeInTheDocument();
  });
});

describe('ShiftPage — box card actions', () => {
  const washing = { number: 1, is_open: true, current: liveBooking('w1', { status: 'washing' }) } as LiveBox;

  it('Завершить moves the booking to ready and bumps the day counter', async () => {
    setBoard([washing], [row({ id: 'w1', status: 'washing' })]);
    renderPage();
    expect(await screen.findByText('Помыто сегодня: 0')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Завершить' }));
    await waitFor(() => expect(updateBookingStatus).toHaveBeenCalledWith('w1', 'ready'));
    expect(await screen.findByText('Помыто сегодня: 1')).toBeInTheDocument();
  });

  it('Пауза pauses, and Продолжить resumes a paused one', async () => {
    setBoard([washing], [row({ id: 'w1', status: 'washing' })]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Пауза' }));
    await waitFor(() => expect(pauseBooking).toHaveBeenCalledWith('w1'));

    cleanup();
    setBoard([{ ...washing, current: liveBooking('w1', { status: 'washing', paused_at: START }) }], [row({ id: 'w1', status: 'washing' })]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Продолжить' }));
    await waitFor(() => expect(resumeBooking).toHaveBeenCalledWith('w1'));
  });
});

describe('ShiftPage — taking a booking off the queue', () => {
  it('needs a second click to confirm, and can be backed out of', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Снять' }));
    expect(cancelBooking).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.getByRole('button', { name: 'Снять' })).toBeInTheDocument();
    expect(cancelBooking).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Снять' }));
    fireEvent.click(screen.getByRole('button', { name: 'Точно снять?' }));
    await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith('q1'));
  });
});

describe('ShiftPage — errors', () => {
  it('shows the API message of a failed action and dismisses it on click', async () => {
    updateBookingStatus.mockRejectedValue(new ApiError('invalid_status_transition', 'Нельзя начать мойку', 409));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Начать' }));

    const banner = await screen.findByText(/Нельзя начать мойку/);
    fireEvent.click(banner);
    expect(screen.queryByText(/Нельзя начать мойку/)).not.toBeInTheDocument();
  });

  it('falls back to a generic message for non-API failures', async () => {
    cancelBooking.mockRejectedValue(new Error('boom'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Снять' }));
    fireEvent.click(screen.getByRole('button', { name: 'Точно снять?' }));
    expect(await screen.findByText(/Не удалось выполнить запрос/)).toBeInTheDocument();
  });
});

describe('ShiftPage — mobile', () => {
  it('shows one box at a time with a switcher, and queue cards instead of the table', async () => {
    mobile = true;
    setBoard(
      [
        { number: 1, is_open: true },
        { number: 2, is_open: true },
      ],
      [row({ id: 'q1', box_number: 2, car_name: 'Second Car' })],
    );
    renderPage();

    const switcher = await screen.findByRole('button', { name: /Бокс 2/ });
    expect(screen.getAllByText('Свободен')).toHaveLength(1); // only the selected box's card
    fireEvent.click(switcher);
    expect(within(document.body).getByText(/Second Car/)).toBeInTheDocument();
    expect(screen.queryByText('Бокс')).not.toBeInTheDocument(); // no table header on mobile
  });
});
