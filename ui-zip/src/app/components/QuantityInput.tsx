import { useState } from 'react';

interface QuantityInputProps {
  label: string;
  value: number;
  unit?: string;
  onChange: (value: number) => void;
  placeholder?: string;
}

export function QuantityInput({ label, value, unit = 'kg', onChange, placeholder }: QuantityInputProps) {
  const [localValue, setLocalValue] = useState(value.toString());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      onChange(numValue);
    } else if (newValue === '') {
      onChange(0);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-gray-600">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder || '0'}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          step="0.1"
          min="0"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          {unit}
        </span>
      </div>
    </div>
  );
}
