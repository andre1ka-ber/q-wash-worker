import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from 'q-wash-shared';
import { PhotoStrip } from './PhotoStrip';

const listBookingPhotos = vi.fn();
const uploadBookingPhoto = vi.fn();
const deleteBookingPhoto = vi.fn();

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    listBookingPhotos: (...a: unknown[]) => listBookingPhotos(...a),
    uploadBookingPhoto: (...a: unknown[]) => uploadBookingPhoto(...a),
    deleteBookingPhoto: (...a: unknown[]) => deleteBookingPhoto(...a),
  };
});

function renderStrip() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PhotoStrip bookingId="b1" />
    </QueryClientProvider>,
  );
}

const file = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

beforeEach(() => {
  listBookingPhotos.mockResolvedValue({ items: [{ id: 'p1', url: '/uploads/a.jpg' }] });
  uploadBookingPhoto.mockResolvedValue({ id: 'p2', url: '/uploads/b.jpg' });
  deleteBookingPhoto.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PhotoStrip', () => {
  it('lists the booking\'s photos with a count', async () => {
    renderStrip();
    expect(await screen.findByText('1 фото')).toBeInTheDocument();
    expect(listBookingPhotos).toHaveBeenCalledWith('b1');
    expect(screen.getAllByRole('button', { name: 'Удалить фото' })).toHaveLength(1);
  });

  it('uploads every picked file in order, then refetches', async () => {
    renderStrip();
    await screen.findByText('1 фото');
    fireEvent.change(screen.getByLabelText('Добавить фото'), { target: { files: [file('1.jpg'), file('2.jpg')] } });

    await waitFor(() => expect(uploadBookingPhoto).toHaveBeenCalledTimes(2));
    expect((uploadBookingPhoto.mock.calls[0][1] as File).name).toBe('1.jpg');
    expect((uploadBookingPhoto.mock.calls[1][1] as File).name).toBe('2.jpg');
    expect(uploadBookingPhoto.mock.calls[0][0]).toBe('b1');
    await waitFor(() => expect(listBookingPhotos).toHaveBeenCalledTimes(2));
  });

  it('shows the API message when an upload is refused', async () => {
    uploadBookingPhoto.mockRejectedValue(new ApiError('photo_limit_reached', 'a booking can have at most 10 photos', 409));
    renderStrip();
    await screen.findByText('1 фото');
    fireEvent.change(screen.getByLabelText('Добавить фото'), { target: { files: [file('1.jpg')] } });
    expect(await screen.findByText('a booking can have at most 10 photos')).toBeInTheDocument();
  });

  it('removes a photo', async () => {
    renderStrip();
    fireEvent.click(await screen.findByRole('button', { name: 'Удалить фото' }));
    await waitFor(() => expect(deleteBookingPhoto).toHaveBeenCalledWith('b1', 'p1'));
  });
});
