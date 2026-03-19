import { MobileLayout } from '../components/MobileLayout';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

export function StoreRequisitionList() {
  const navigate = useNavigate();
  
  const requisitions = [
    {
      id: 1,
      kitchen: 'Chinese Kitchen',
      items: [
        { name: 'Chicken Breast', requested: '1 kg', available: '500 g' },
        { name: 'Onion', requested: '2 kg', available: '2 kg' },
      ],
    },
    {
      id: 2,
      kitchen: 'Tandoor Kitchen',
      items: [
        { name: 'Paneer', requested: '2 kg', available: '1.5 kg' },
        { name: 'Tomato', requested: '3 kg', available: '3 kg' },
      ],
    },
  ];
  
  return (
    <MobileLayout showNav={false} navType="store">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl text-gray-900">All Requisitions</h1>
            <p className="text-sm text-gray-500">{requisitions.length} pending</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {requisitions.map((req) => (
          <div
            key={req.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <div className="bg-green-50 px-6 py-4 border-b border-green-100">
              <h3 className="text-gray-900">{req.kitchen}</h3>
              <p className="text-sm text-gray-600 mt-1">{req.items.length} items requested</p>
            </div>

            <div className="p-4 space-y-3">
              {req.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <h4 className="text-gray-900 text-sm">{item.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Requested: <span className="text-orange-600">{item.requested}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Available</p>
                    <p className="text-green-600 text-sm">{item.available}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 pb-4">
              <button
                onClick={() => navigate(`/store/issue/${req.id}`)}
                className="w-full bg-accent text-white py-3 rounded-lg hover:bg-green-600 transition-colors active:scale-98"
              >
                Process Requisition
              </button>
            </div>
          </div>
        ))}
      </div>
    </MobileLayout>
  );
}
