import { useState, useEffect } from 'react';

interface ItemInputRowProps {
  itemName: string;
  unit?: string;
  onUpdate: (data: { closing: number; required: number; requested: number }) => void;
}

export function ItemInputRow({ itemName, unit = 'kg', onUpdate }: ItemInputRowProps) {
  const [closing, setClosing] = useState(0);
  const [required, setRequired] = useState(0);
  const [requested, setRequested] = useState(0);

  useEffect(() => {
    const calc = Math.max(required - closing, 0);
    setRequested(calc);
    onUpdate({ closing, required, requested: calc });
  }, [closing, required]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h4 className="text-gray-900">{itemName}</h4>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Closing Stock</label>
          <div className="relative">
            <input
              type="number"
              value={closing || ''}
              onChange={(e) => setClosing(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              step="0.1"
              min="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {unit}
            </span>
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Required Today</label>
          <div className="relative">
            <input
              type="number"
              value={required || ''}
              onChange={(e) => setRequired(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              step="0.1"
              min="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {unit}
            </span>
          </div>
        </div>
      </div>
      
      {requested > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 flex items-center justify-between">
          <span className="text-sm text-orange-900">To Request:</span>
          <span className="text-orange-600">
            {requested.toFixed(1)} {unit}
          </span>
        </div>
      )}
    </div>
  );
}
