import { useState } from 'react';
import { DesktopLayout } from '../components/DesktopLayout';
import { Plus, Edit, Trash2 } from 'lucide-react';

export function UserManagement() {
  const [showAddModal, setShowAddModal] = useState(false);

  const users = [
    { id: 1, name: 'John Chen', role: 'Kitchen User', kitchen: 'Chinese Kitchen', status: 'Active' },
    { id: 2, name: 'Sarah Patel', role: 'Kitchen User', kitchen: 'Tandoor Kitchen', status: 'Active' },
    { id: 3, name: 'Mike Ross', role: 'Store User', kitchen: 'Central Store', status: 'Active' },
    { id: 4, name: 'Emma Wilson', role: 'Admin', kitchen: '-', status: 'Active' },
    { id: 5, name: 'David Lee', role: 'Kitchen User', kitchen: 'Italian Kitchen', status: 'Inactive' },
  ];

  const roles = ['Kitchen User', 'Store User', 'Admin'];
  const kitchens = ['Chinese Kitchen', 'Tandoor Kitchen', 'Italian Kitchen', 'Central Store'];

  return (
    <DesktopLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl text-gray-900 mb-2">User Management</h1>
            <p className="text-gray-600">Manage system users and their roles</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add User
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Name</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Role</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Kitchen / Store</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Status</th>
                <th className="text-right px-6 py-4 text-sm text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">{user.name}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{user.kitchen}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        user.status === 'Active'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
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

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4">
              <h2 className="text-2xl text-gray-900 mb-6">Add New User</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    placeholder="user@restaurant.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Role</label>
                  <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                    <option value="">Select role</option>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Kitchen / Store</label>
                  <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                    <option value="">Select kitchen or store</option>
                    {kitchens.map((kitchen) => (
                      <option key={kitchen} value={kitchen}>
                        {kitchen}
                      </option>
                    ))}
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
                    alert('User added successfully!');
                    setShowAddModal(false);
                  }}
                  className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DesktopLayout>
  );
}
