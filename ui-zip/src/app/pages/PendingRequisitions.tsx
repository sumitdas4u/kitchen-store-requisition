import { MobileLayout } from '../components/MobileLayout';
import { IssueCard } from '../components/IssueCard';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

export function PendingRequisitions() {
  const navigate = useNavigate();
  
  const pendingItems = [
    { id: 1, itemName: 'Chicken Breast', requested: '1 kg', issued: '500 g', status: 'issued' as const },
    { id: 2, itemName: 'Onion', requested: '2 kg', status: 'waiting' as const },
    { id: 3, itemName: 'Tomato', requested: '1.5 kg', status: 'waiting' as const },
    { id: 4, itemName: 'Soy Sauce', requested: '500 ml', issued: '500 ml', status: 'completed' as const },
  ];
  
  return (
    <MobileLayout showNav={false}>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl text-gray-900">Pending Requisitions</h1>
            <p className="text-sm text-gray-500">{pendingItems.length} items</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-3">
        {pendingItems.map((item) => (
          <IssueCard
            key={item.id}
            itemName={item.itemName}
            requested={item.requested}
            issued={item.issued}
            status={item.status}
            onClick={() => navigate(`/kitchen/receive/${item.id}`)}
          />
        ))}
      </div>
    </MobileLayout>
  );
}
