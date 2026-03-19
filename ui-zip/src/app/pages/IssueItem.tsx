import { useState } from 'react';
import { MobileLayout } from '../components/MobileLayout';
import { ArrowLeft, Send, SkipForward } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

export function IssueItem() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [issueQuantity, setIssueQuantity] = useState('');
  
  // Mock data
  const requisition = {
    kitchen: 'Chinese Kitchen',
    item: 'Chicken Breast',
    requested: '1',
    requestedUnit: 'kg',
    available: '0.5',
    availableUnit: 'kg',
  };

  const handleIssue = () => {
    if (!issueQuantity || parseFloat(issueQuantity) <= 0) {
      alert('Please enter a valid quantity');
      return;
    }
    alert(`Issued ${issueQuantity} ${requisition.requestedUnit} successfully!`);
    navigate('/store/requisitions');
  };

  const handleSkip = () => {
    if (confirm('Are you sure you want to skip this item?')) {
      navigate('/store/requisitions');
    }
  };

  return (
    <MobileLayout showNav={false} navType="store">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl text-gray-900">Issue Item</h1>
            <p className="text-sm text-gray-500">{requisition.kitchen}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-2xl text-gray-900 mb-1">{requisition.item}</h2>
            <p className="text-sm text-gray-500">Kitchen: {requisition.kitchen}</p>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <span className="text-gray-700">Requested</span>
              <span className="text-orange-600">
                {requisition.requested} {requisition.requestedUnit}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-gray-700">Available in Store</span>
              <span className="text-green-600">
                {requisition.available} {requisition.availableUnit}
              </span>
            </div>
          </div>
        </div>

        {/* Issue Quantity Input */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-gray-700 mb-3">Issue Quantity</label>
          <div className="relative">
            <input
              type="number"
              value={issueQuantity}
              onChange={(e) => setIssueQuantity(e.target.value)}
              placeholder="Enter quantity to issue"
              className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              step="0.1"
              min="0"
              max={requisition.available}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              {requisition.requestedUnit}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setIssueQuantity(requisition.available)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              Max Available
            </button>
            <button
              onClick={() => setIssueQuantity(requisition.requested)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              Full Request
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleSkip}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors active:scale-98"
          >
            <SkipForward className="w-5 h-5" />
            Skip
          </button>
          
          <button
            onClick={handleIssue}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-accent text-white rounded-lg hover:bg-green-600 transition-colors active:scale-98"
          >
            <Send className="w-5 h-5" />
            Issue Item
          </button>
        </div>
      </div>
    </MobileLayout>
  );
}
