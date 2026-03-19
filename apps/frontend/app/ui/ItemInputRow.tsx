import { useEffect, useState } from 'react';

interface ItemInputRowProps {
  itemName: string;
  itemCode: string;
  unit?: string;
  closingStock?: number;
  onUpdate: (data: { closing: number; actualClosing: number | null; orderQty: number }) => void;
}

export function ItemInputRow({
  itemName,
  itemCode,
  unit = 'kg',
  closingStock,
  onUpdate
}: ItemInputRowProps) {
  const [closing, setClosing] = useState(0);
  const [actualClosingInput, setActualClosingInput] = useState('');
  const [orderQtyInput, setOrderQtyInput] = useState('');

  useEffect(() => {
    if (typeof closingStock === 'number') {
      setClosing(closingStock);
    }
  }, [closingStock]);

  useEffect(() => {
    const actualValue =
      actualClosingInput.trim() === '' ? null : Number(actualClosingInput);
    const orderValue = orderQtyInput.trim() === '' ? 0 : Number(orderQtyInput);
    onUpdate({
      closing,
      actualClosing: Number.isNaN(actualValue as number) ? null : actualValue,
      orderQty: Number.isNaN(orderValue) ? 0 : orderValue
    });
  }, [closing, actualClosingInput, orderQtyInput, onUpdate]);

  const orderQty = orderQtyInput.trim() === '' ? 0 : Number(orderQtyInput);
  const actualClosing =
    actualClosingInput.trim() === '' ? 0 : Number(actualClosingInput);

  const adjustValue = (
    current: number,
    setter: (value: string) => void,
    delta: number
  ) => {
    const next = Math.max(0, Number((current + delta).toFixed(3)));
    setter(String(next));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div>
        <h4 className="text-base text-gray-900 font-semibold">{itemName}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{itemCode}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Closing Balance</label>
          <div className="relative">
            <input
              type="number"
              value={closing || ''}
              placeholder="0"
              className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-base focus:outline-none"
              step="0.1"
              min="0"
              disabled
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {unit}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Actual Closing</label>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button
              type="button"
              className="w-9 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50"
              onClick={() => adjustValue(actualClosing, setActualClosingInput, -1)}
            >
              −
            </button>
            <input
              type="number"
              value={actualClosingInput}
              onChange={(e) => setActualClosingInput(e.target.value)}
              placeholder="0"
              className="w-full h-10 text-center text-sm font-semibold focus:outline-none"
              step="0.1"
              min="0"
            />
            <button
              type="button"
              className="w-9 h-10 flex items-center justify-center text-white bg-orange-500 hover:bg-orange-600"
              onClick={() => adjustValue(actualClosing, setActualClosingInput, 1)}
            >
              +
            </button>
          </div>
          <div className="text-[10px] text-gray-400 mt-1 text-right">{unit}</div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Order Qty</label>
          <div className="flex items-center border border-orange-200 rounded-lg overflow-hidden bg-orange-50">
            <button
              type="button"
              className="w-9 h-10 flex items-center justify-center text-gray-700 hover:bg-orange-100"
              onClick={() => adjustValue(orderQty, setOrderQtyInput, -1)}
            >
              −
            </button>
            <input
              type="number"
              value={orderQtyInput}
              onChange={(e) => setOrderQtyInput(e.target.value)}
              placeholder="0"
              className="w-full h-10 text-center text-sm font-semibold text-orange-700 focus:outline-none bg-transparent"
              step="0.1"
              min="0"
            />
            <button
              type="button"
              className="w-9 h-10 flex items-center justify-center text-white bg-orange-600 hover:bg-orange-700"
              onClick={() => adjustValue(orderQty, setOrderQtyInput, 1)}
            >
              +
            </button>
          </div>
          <div className="text-[10px] text-orange-500 mt-1 text-right">{unit}</div>
        </div>
      </div>

      {orderQty > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 flex items-center justify-between">
          <span className="text-sm text-orange-900">To Request:</span>
          <span className="text-orange-600">
            {orderQty.toFixed(1)} {unit}
          </span>
        </div>
      )}
    </div>
  );
}
