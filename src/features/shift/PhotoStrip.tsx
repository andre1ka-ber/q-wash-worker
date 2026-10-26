import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  color,
  font,
  ApiError,
  deleteBookingPhoto,
  listBookingPhotos,
  resolveApiAssetUrl,
  uploadBookingPhoto,
} from 'q-wash-shared';

const THUMB = 70;

export interface PhotoStripProps {
  bookingId: string;
}

export function PhotoStrip({ bookingId }: PhotoStripProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const queryKey = ['worker', 'booking-photos', bookingId];

  const photosQuery = useQuery({ queryKey, queryFn: () => listBookingPhotos(bookingId) });
  const photos = photosQuery.data?.items ?? [];

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await uploadBookingPhoto(bookingId, file);
      }
    },
    onMutate: () => setError(null),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить фото'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => deleteBookingPhoto(bookingId, photoId),
    onMutate: () => setError(null),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось удалить фото'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const thumbBase = {
    flex: `0 0 ${THUMB}px`,
    width: THUMB,
    height: THUMB,
    boxSizing: 'border-box',
    borderRadius: 12,
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600 }}>Фото</span>
        <span style={{ color: color.textTertiary, fontSize: 11.5 }}>
          {uploadMutation.isPending ? 'Загрузка…' : photos.length ? `${photos.length} фото` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', alignItems: 'center' }}>
        <label
          style={{
            ...thumbBase,
            border: `1.5px dashed ${color.gold}`,
            background: 'rgba(242,209,75,.06)',
            color: color.gold,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            cursor: uploadMutation.isPending ? 'default' : 'pointer',
            opacity: uploadMutation.isPending ? 0.6 : 1,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: font.body,
          }}
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            aria-label="Добавить фото"
            disabled={uploadMutation.isPending}
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length) uploadMutation.mutate(files);
            }}
          />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h3l2-2.5h6L17 8h3v11H4V8Z" />
            <circle cx="12" cy="13" r="3.2" />
          </svg>
          <span>Добавить</span>
        </label>
        {photos.map((photo) => (
          <div
            key={photo.id}
            style={{
              ...thumbBase,
              position: 'relative',
              overflow: 'hidden',
              border: `1px solid ${color.borderDashed}`,
              background: `center / cover no-repeat url(${resolveApiAssetUrl(photo.url)})`,
              opacity: deleteMutation.isPending && deleteMutation.variables === photo.id ? 0.5 : 1,
            }}
          >
            <button
              type="button"
              aria-label="Удалить фото"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(photo.id)}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 20,
                height: 20,
                padding: 0,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(18,18,17,.82)',
                color: color.textPrimaryAlt,
                fontSize: 12,
                lineHeight: '20px',
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {error && <div style={{ color: color.bad, fontSize: 12 }}>{error}</div>}
    </div>
  );
}
