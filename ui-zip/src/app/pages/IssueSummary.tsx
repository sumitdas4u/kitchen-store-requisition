import { MobileLayout } from '../components/MobileLayout';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';

export function IssueSummary() {
  const navigate = useNavigate();
  
  const issuedToday = [
    { item: 'Chicken Breast', quantity: '500 g', kitchen: 'Chinese Kitchen', time: '10:30 AM' },
    { item: 'Onion', quantity: '2 kg', kitchen: 'Tandoor Kitchen', time: '10:45 AM' },
    { item: 'Tomato', quantity: '1.5 kg', kitchen: 'Chinese Kitchen', time: '11:00 AM' },
    { item: 'Paneer', quantity: '1.5 kg', kitchen: 'Tandoor Kitchen', time: '11:15 AM' },
    { item: 'Soy Sauce', quantity: '500 ml', kitchen: 'Chinese Kitchen', time: '11:30 AM' },
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
            <h1 className="text-xl text-gray-900">Today's Issues</h1>
            <p className="text-sm text-gray-500">{issuedToday.length} items issued</p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700 mb-1">Items Issued</p>
            <p className="text-2xl text-green-900">{issuedToday.length}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700 mb-1">Kitchens Served</p>
            <p className="text-2xl text-blue-900">2</p>
          </div>
        </div>

        {/* Issue List */}
        <div className="space-y-3">
          <h2 className="text-sm text-gray-500 px-1">Issue History</h2>
          
          {issuedToday.map((issue, idx) => (
            <div
              key={idx}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="text-gray-900">{issue.item}</h4>
                  <p className="text-sm text-gray-500 mt-0.5">{issue.time}</p>
                </div>
                <span className="text-green-600">{issue.quantity}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600 pt-2 border-t border-gray-100">
                <ArrowRight className="w-4 h-4" />
                <span>{issue.kitchen}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MobileLayout>
  );
}
