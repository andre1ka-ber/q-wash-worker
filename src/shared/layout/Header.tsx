import { useState } from 'react';
import { authStore, useAuth, useIsMobile, color, font, radius, StatusPill, ConfirmDialog } from 'q-wash-shared';
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

  const isMobile = useIsMobile();
  const firstName = masterName.split(' ')[0];
  const shortDate = now.toLocaleDateString('ru-RU', { timeZone: 'Asia/Dushanbe', day: 'numeric', month: 'long' });

  if (isMobile) {
    return (
      <>
        <div
          style={{
            padding: '22px 18px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div style={{ color: color.textPrimary, fontSize: 20, fontWeight: 600, letterSpacing: '-.03em' }}>
              Смена · {firstName}
            </div>
            <div
              style={{
                color: color.textTertiary,
                fontSize: 12,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {pointName} · {shortDate}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <div style={{ color: color.ok, fontSize: 20, fontWeight: 700 }}>{completedCount}</div>
              <div style={{ color: color.textTertiary, fontSize: 11 }}>вымыто</div>
            </div>
            <button
              type="button"
              aria-label="Выйти"
              onClick={() => setLogoutConfirmOpen(true)}
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.sm,
                border: `1px solid ${color.borderStrong}`,
                background: 'transparent',
                color: color.textMuted,
                cursor: 'pointer',
                fontSize: 15,
              }}
            >
              ⎋
            </button>
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
