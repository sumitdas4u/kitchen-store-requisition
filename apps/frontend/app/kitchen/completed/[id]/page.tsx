import { Suspense } from 'react';
import { CompletedRequisitionDetails } from '../../../ui/pages/CompletedRequisitionDetails';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompletedRequisitionDetails />
    </Suspense>
  );
}
