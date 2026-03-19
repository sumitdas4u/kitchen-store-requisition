import { useState } from 'react';
import { MobileLayout } from '../components/MobileLayout';
import { ItemInputRow } from '../components/ItemInputRow';
import { ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router';

interface ItemData {
  closing: number;
  required: number;
  requested: number;
}

export function CreateRequisition() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Record<string, ItemData>>({});

  const itemGroups = {
    'Indian Vegetables': [
      { name: 'Onion', unit: 'kg' },
      { name: 'Tomato', unit: 'kg' },
      { name: 'Potato', unit: 'kg' },
    ],
    'Chicken': [
      { name: 'Chicken Breast', unit: 'kg' },
      { name: 'Chicken Thigh', unit: 'kg' },
    ],
    'Sauces': [
      { name: 'Soy Sauce', unit: 'L' },
      { name: 'Oyster Sauce', unit: 'L' },
    ],
  };

  const handleItemUpdate = (itemName: string, data: ItemData) => {
    setItems((prev) => ({ ...prev, [itemName]: data }));
  };

  const handleSubmit = () => {
    // Mock submit
    alert('Requisition submitted successfully!');
    navigate('/kitchen/pending');
  };

  const totalRequested = Object.values(items).reduce((sum, item) => sum + (item.requested || 0), 0);

  return (
    <MobileLayout showNav={false}>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl text-gray-900">Create Requisition</h1>
            <p className="text-sm text-gray-500">Chinese Kitchen</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {Object.entries(itemGroups).map(([groupName, groupItems]) => (
          <div key={groupName} className="space-y-3">
            <h2 className="text-sm text-gray-500 px-1">{groupName}</h2>
            {groupItems.map((item) => (
              <ItemInputRow
                key={item.name}
                itemName={item.name}
                unit={item.unit}
                onUpdate={(data) => handleItemUpdate(item.name, data)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
        {totalRequested > 0 && (
          <div className="mb-4 p-3 bg-orange-50 rounded-lg flex items-center justify-between">
            <span className="text-sm text-orange-900">Total Items to Request:</span>
            <span className="text-orange-600">{Object.values(items).filter(i => i.requested > 0).length}</span>
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={totalRequested === 0}
          className="w-full bg-primary text-white py-4 rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" />
          Submit Requisition
        </button>
      </div>
    </MobileLayout>
  );
}
