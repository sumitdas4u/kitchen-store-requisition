import { useState } from 'react';
import { DesktopLayout } from '../components/DesktopLayout';
import { Plus, Edit, Trash2 } from 'lucide-react';

export function KitchenManagement() {
  const [showAddModal, setShowAddModal] = useState(false);

  const kitchens = [
    {
      id: 1,
      name: 'Chinese Kitchen',
      warehouse: 'Central Store',
      itemGroups: ['Chicken', 'Sauces', 'Vegetables'],
      users: 3,
    },
    {
      id: 2,
      name: 'Tandoor Kitchen',
      warehouse: 'Central Store',
      itemGroups: ['Chicken', 'Dairy', 'Indian Vegetables'],
      users: 2,
    },
    {
      id: 3,
      name: 'Italian Kitchen',
      warehouse: 'Central Store',
      itemGroups: ['Cheese', 'Pasta', 'Vegetables'],
      users: 2,
    },
  ];

  return (
    <DesktopLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl text-gray-900 mb-2">Kitchen Management</h1>
            <p className="text-gray-600">Manage kitchens and their configurations</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Kitchen
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Kitchen Name</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Warehouse</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Item Groups</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Users</th>
                <th className="text-right px-6 py-4 text-sm text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {kitchens.map((kitchen) => (
                <tr key={kitchen.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">{kitchen.name}</td>
                  <td className="px-6 py-4 text-gray-600">{kitchen.warehouse}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {kitchen.itemGroups.map((group, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded-full"
                        >
                          {group}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{kitchen.users}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4">
              <h2 className="text-2xl text-gray-900 mb-6">Add New Kitchen</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Kitchen Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Chinese Kitchen"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Warehouse</label>
                  <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                    <option>Central Store</option>
                    <option>Secondary Store</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    alert('Kitchen added successfully!');
                    setShowAddModal(false);
                  }}
                  className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Add Kitchen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DesktopLayout>
  );
}
