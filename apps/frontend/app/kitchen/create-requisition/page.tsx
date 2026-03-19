import { Suspense } from 'react';
import { CreateRequisition } from '../../ui/pages/CreateRequisition';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CreateRequisition />
    </Suspense>
  );
}
