import { useEffect, useState } from 'react';

// Ticks once a second — drives the header's live clock and every box
// card's elapsed-time bar. One shared interval per mounted screen rather
// than one per box card.
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

// Booking/queue timestamps resolve in the platform's fixed businessLocation
// (Asia/Dushanbe, see the root CLAUDE.md) — the shop clock should match
// that, not the browser's local timezone.
export function formatClock(date: Date): string {
  return date.toLocaleTimeString('ru-RU', {
    timeZone: 'Asia/Dushanbe',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Dushanbe',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
