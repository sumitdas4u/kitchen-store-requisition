import { MobileLayout } from '../components/MobileLayout';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

export function ReceiveItems() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Mock data
  const item = {
    itemName: 'Chicken Breast',
    requested: '1 kg',
    issued: '500 g',
    status: 'issued',
  };

  const handleAccept = () => {
    alert('Item accepted successfully!');
    navigate('/kitchen/pending');
  };

  const handleReject = () => {
    if (confirm('Are you sure you want to reject this item?')) {
      alert('Item rejected');
      navigate('/kitchen/pending');
    }
  };

  return (
    <MobileLayout showNav={false}>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl text-gray-900">Receive Item</h1>
            <p className="text-sm text-gray-500">Review and accept</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-2xl text-gray-900 mb-2">{item.itemName}</h2>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
              Issued
            </span>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Requested</span>
              <span className="text-orange-600">{item.requested}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Issued by Store</span>
              <span className="text-green-600">{item.issued}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              The store has issued a different quantity than requested. Please review and accept or reject.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleReject}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors active:scale-98"
          >
            <X className="w-5 h-5" />
            Reject
          </button>
          
          <button
            onClick={handleAccept}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-accent text-white rounded-lg hover:bg-green-600 transition-colors active:scale-98"
          >
            <Check className="w-5 h-5" />
            Accept
          </button>
        </div>
      </div>
    </MobileLayout>
  );
}
