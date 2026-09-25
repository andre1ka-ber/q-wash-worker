import { useState } from 'react';
import { authStore, useAuth, color, font, radius, StatusPill, LogoMark, ConfirmDialog } from 'q-wash-shared';
import { useClock, formatClock, formatDayLabel } from '../useClock';
import { useMyWashingPoint } from '../useMyWashingPoint';

export interface HeaderProps {
  completedCount: number;
}

export function Header({ completedCount }: HeaderProps) {
  const { user } = useAuth();
  const now = useClock();
  const masterName = user?.name ?? 'Мастер';
  const pointQuery = useMyWashingPoint();
  const pointName = pointQuery.data?.name ?? '…';
  const pointAddress = pointQuery.data?.address ?? '';
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  return (
    <>
      <div
        style={{
          padding: '20px 32px',
          borderBottom: `1px solid ${color.borderAlt}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <LogoMark size={40} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: font.display,
                color: color.textPrimary,
                fontSize: 18,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {pointName}
            </div>
            <div style={{ color: color.textFaint, fontSize: 12 }}>{pointAddress}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: '0 0 auto' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: color.textPrimaryAlt, fontSize: 14, fontWeight: 600 }}>{masterName}</div>
            <div style={{ color: color.textFaint, fontSize: 12, textTransform: 'capitalize' }}>
              {formatDayLabel(now)}
            </div>
          </div>

          <div
            style={{
              fontFamily: font.display,
              color: color.textPrimary,
              fontSize: 20,
              minWidth: 92,
              textAlign: 'center',
            }}
          >
            {formatClock(now)}
          </div>

          <StatusPill kind="ok">Помыто сегодня: {completedCount}</StatusPill>

          <div
            onClick={() => setLogoutConfirmOpen(true)}
            title="Выйти"
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.sm,
              border: `1px solid ${color.borderStrong}`,
              color: color.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 15,
            }}
          >
            ⎋
          </div>
        </div>
      </div>
      {logoutConfirmOpen && (
        <ConfirmDialog
          title="Выйти из аккаунта?"
          message="Понадобится снова ввести логин и пароль, чтобы продолжить работу."
          confirmLabel="Выйти"
          onConfirm={() => void authStore.logout()}
          onCancel={() => setLogoutConfirmOpen(false)}
        />
      )}
    </>
  );
}
