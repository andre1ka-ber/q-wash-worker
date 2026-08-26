import { useQuery } from '@tanstack/react-query';
import { useAuth, getWashingPoint } from 'q-wash-shared';

// Same pattern as q-wash-cabinet's own useMyWashingPoint.ts — every screen
// in this app is scoped to the logged-in staff/worker's own point.
// App.tsx's ProtectedRoute guarantees user.washing_point_id is set before
// any route renders, so the assertion here is safe. GET /washing-points/{id}
// itself is public (no requireQueueOps needed) — see washingpoint.Handler.
export function useMyWashingPointId(): string {
  const { user } = useAuth();
  return user!.washing_point_id!;
}

export function useMyWashingPoint() {
  const washingPointId = useMyWashingPointId();
  return useQuery({
    queryKey: ['worker', 'washing-point', washingPointId],
    queryFn: () => getWashingPoint(washingPointId),
  });
}
