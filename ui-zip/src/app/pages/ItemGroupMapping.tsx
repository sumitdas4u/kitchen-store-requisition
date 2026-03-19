import { useState } from 'react';
import { DesktopLayout } from '../components/DesktopLayout';

export function ItemGroupMapping() {
  const kitchens = ['Chinese Kitchen', 'Tandoor Kitchen', 'Italian Kitchen'];
  
  const itemGroups = [
    'Chicken',
    'Sauces',
    'Vegetables',
    'Indian Vegetables',
    'Dairy',
    'Cheese',
    'Pasta',
    'Seafood',
    'Spices',
  ];

  const [selectedKitchen, setSelectedKitchen] = useState('Chinese Kitchen');
  const [mappings, setMappings] = useState({
    'Chinese Kitchen': ['Chicken', 'Sauces', 'Vegetables'],
    'Tandoor Kitchen': ['Chicken', 'Dairy', 'Indian Vegetables', 'Spices'],
    'Italian Kitchen': ['Cheese', 'Pasta', 'Vegetables'],
  });

  const toggleMapping = (group: string) => {
    setMappings((prev) => {
      const current = prev[selectedKitchen as keyof typeof prev] || [];
      const updated = current.includes(group)
        ? current.filter((g) => g !== group)
        : [...current, group];
      return { ...prev, [selectedKitchen]: updated };
    });
  };

  return (
    <DesktopLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Item Group Mapping</h1>
          <p className="text-gray-600">Configure which item groups are accessible to each kitchen</p>
        </div>

        {/* Kitchen Selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-sm text-gray-700 mb-3">Select Kitchen</label>
          <div className="grid grid-cols-3 gap-3">
            {kitchens.map((kitchen) => (
              <button
                key={kitchen}
                onClick={() => setSelectedKitchen(kitchen)}
                className={`px-6 py-3 rounded-lg transition-all ${
                  selectedKitchen === kitchen
                    ? 'bg-primary text-white'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {kitchen}
              </button>
            ))}
          </div>
        </div>

        {/* Item Groups */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg text-gray-900 mb-6">
            Item Groups for {selectedKitchen}
          </h3>
          
          <div className="grid grid-cols-3 gap-4">
            {itemGroups.map((group) => {
              const isSelected = mappings[selectedKitchen as keyof typeof mappings]?.includes(group);
              return (
                <label
                  key={group}
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMapping(group)}
                    className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className={isSelected ? 'text-gray-900' : 'text-gray-700'}>
                    {group}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={() => alert('Mappings saved successfully!')}
            className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Save Mappings
          </button>
        </div>
      </div>
    </DesktopLayout>
  );
}
