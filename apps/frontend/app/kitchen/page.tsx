import { Suspense } from 'react';
import { KitchenDashboard } from '../ui/pages/KitchenDashboard';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KitchenDashboard />
    </Suspense>
  );
}
