import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, useAuth, color, font, GhostButton } from 'q-wash-shared';
import { LoginPage } from './features/auth/LoginPage';
import { ShiftPage } from './features/shift/ShiftPage';

const queryClient = new QueryClient();

function FullScreenLoader() {
  return <div style={{ minHeight: '100vh', background: color.pageBg }} />;
}

// Same no-picker assumption as q-wash-cabinet (PLAN.md's Auth decision):
// this app has nothing to show an account with no washing_point_id. Staff
// are let in alongside worker (a shift lead may run the box view
// themselves), same as q-wash-cabinet does.
function UnsupportedAccount() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: color.pageBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: '100%',
          background: color.panel,
          border: `1px solid ${color.border}`,
          borderRadius: 20,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          textAlign: 'center',
        }}
      >
        <div style={{ fontFamily: font.display, color: color.textPrimary, fontSize: 18 }}>
          Этот аккаунт не привязан к мойке
        </div>
        <div style={{ color: color.textMuted, fontSize: 13 }}>
          Приложение мастера доступно только сотрудникам, закреплённым за конкретной мойкой. Обратитесь к
          администратору сети.
        </div>
        <GhostButton onClick={() => void authStore.logout()} style={{ alignSelf: 'center', padding: '11px 22px' }}>
          Выйти
        </GhostButton>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (!user || (user.role !== 'staff' && user.role !== 'worker') || !user.washing_point_id) {
    return <UnsupportedAccount />;
  }
  return <>{children}</>;
}

function LoginRoute() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <LoginPage />;
}

function AppRoutes() {
  useEffect(() => {
    authStore.restore();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ShiftPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
