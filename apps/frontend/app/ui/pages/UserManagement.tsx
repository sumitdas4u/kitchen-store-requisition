'use client';

import { useEffect, useMemo, useState } from 'react';
import { DesktopLayout } from '../DesktopLayout';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuthGuard } from '../../../lib/auth';
import { apiRequest } from '../../../lib/api';

type AppUser = {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  company: string;
  default_warehouse?: string | null;
  source_warehouse?: string | null;
  is_active: boolean;
  warehouses?: { warehouse: string }[];
};

type ErpCompany = { name: string; company_name?: string };
type ErpWarehouse = { name: string };

export function UserManagement() {
  const token = useAuthGuard('/admin/login');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [warehouses, setWarehouses] = useState<ErpWarehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
    role: 'Kitchen User',
    company: '',
    default_warehouse: '',
    source_warehouse: '',
    warehouses: [] as string[],
    is_active: true
  });

  useEffect(() => {
    if (!token) {
      return;
    }
    const load = async () => {
      try {
        const [usersData, companiesData] = await Promise.all([
          apiRequest<AppUser[]>('/admin/users', 'GET', undefined, token ?? undefined),
          apiRequest<ErpCompany[]>(
            '/admin/erp/companies',
            'GET',
            undefined,
            token ?? undefined
          )
        ]);
        setUsers(usersData);
        setCompanies(companiesData);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    load();
  }, [token]);

  useEffect(() => {
    if (!token || !form.company) {
      setWarehouses([]);
      return;
    }
    apiRequest<ErpWarehouse[]>(
      `/admin/erp/warehouses?company=${encodeURIComponent(form.company)}`,
      'GET',
      undefined,
      token ?? undefined
    )
      .then(setWarehouses)
      .catch(() => setWarehouses([]));
  }, [token, form.company]);

  const warehouseOptions = useMemo(() => warehouses.map((w) => w.name), [warehouses]);

  const toggleWarehouse = (name: string) => {
    setForm((prev) => {
      const exists = prev.warehouses.includes(name);
      const updated = exists ? prev.warehouses.filter((w) => w !== name) : [...prev.warehouses, name];
      return { ...prev, warehouses: updated };
    });
  };

  const refreshUsers = async () => {
    if (!token) {
      return;
    }
    const data = await apiRequest<AppUser[]>(
      '/admin/users',
      'GET',
      undefined,
      token ?? undefined
    );
    setUsers(data);
  };

  const resetForm = () => {
    setForm({
      username: '',
      full_name: '',
      email: '',
      password: '',
      role: 'Kitchen User',
      company: '',
      default_warehouse: '',
      source_warehouse: '',
      warehouses: [],
      is_active: true
    });
  };

  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      password: '',
      role: user.role,
      company: user.company,
      default_warehouse: user.default_warehouse || '',
      source_warehouse: user.source_warehouse || '',
      warehouses: (user.warehouses || []).map((w) => w.warehouse),
      is_active: user.is_active
    });
    setShowEditModal(true);
  };

  return (
    <DesktopLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl text-gray-900 mb-2">User Management</h1>
            <p className="text-gray-600">
              Source warehouse is where stock is taken from. Destination warehouse is the
              user&apos;s receiving warehouse.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingUser(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add User
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Username</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Role</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Company</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Source Warehouse</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Destination Warehouse</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Status</th>
                <th className="text-right px-6 py-4 text-sm text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">{user.username}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{user.company}</td>
                  <td className="px-6 py-4 text-gray-600">{user.source_warehouse || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{user.default_warehouse || '-'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        user.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!token) {
                            return;
                          }
                          await apiRequest(
                            `/admin/users/${user.id}`,
                            'DELETE',
                            undefined,
                            token ?? undefined
                          );
                          refreshUsers();
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4">
              <h2 className="text-2xl text-gray-900 mb-6">
                {showEditModal ? 'Edit User' : 'Add New User'}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                    disabled={showEditModal}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Password {showEditModal ? '(leave blank to keep)' : ''}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <option value="Kitchen User">Kitchen User</option>
                    <option value="Store User">Store User</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Company</label>
                  <select
                    value={form.company}
                    onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <option value="">Select company</option>
                    {companies.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.company_name || c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Destination Warehouse
                  </label>
                  <select
                    value={form.default_warehouse}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => {
                        const warehouses = prev.warehouses.includes(value)
                          ? prev.warehouses
                          : value
                          ? [...prev.warehouses, value]
                          : prev.warehouses;
                        return { ...prev, default_warehouse: value, warehouses };
                      });
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <option value="">Select destination</option>
                    {warehouseOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Source Warehouse (Stock Origin)
                  </label>
                  <select
                    value={form.source_warehouse}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, source_warehouse: e.target.value }))
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <option value="">Select source</option>
                    {warehouseOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                {showEditModal ? (
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      id="is_active"
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                      }
                      className="w-4 h-4 text-primary border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="text-sm text-gray-700">
                      Active user
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="mt-6">
                <h3 className="text-sm text-gray-700 mb-3">Warehouses</h3>
                <div className="grid grid-cols-3 gap-3">
                  {warehouseOptions.map((name) => (
                    <label
                      key={name}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer ${
                        form.warehouses.includes(name)
                          ? 'border-primary bg-orange-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.warehouses.includes(name)}
                        onChange={() => toggleWarehouse(name)}
                        className="w-4 h-4 text-primary border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingUser(null);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={loading}
                  onClick={async () => {
                    if (!token) {
                      return;
                    }
                    setLoading(true);
                    setError(null);
                    try {
                      if (showEditModal && editingUser) {
                        const payload: Record<string, unknown> = {};
                        const nextFullName = form.full_name.trim();
                        const nextEmail = form.email.trim();
                        if (nextFullName && nextFullName !== editingUser.full_name) {
                          payload.full_name = nextFullName;
                        }
                        if (nextEmail && nextEmail !== editingUser.email) {
                          payload.email = nextEmail;
                        }
                        if (form.role !== editingUser.role) {
                          payload.role = form.role;
                        }
                        if (form.company !== editingUser.company) {
                          payload.company = form.company;
                        }
                        if ((form.default_warehouse || '') !== (editingUser.default_warehouse || '')) {
                          payload.default_warehouse = form.default_warehouse;
                        }
                        if ((form.source_warehouse || '') !== (editingUser.source_warehouse || '')) {
                          payload.source_warehouse = form.source_warehouse;
                        }
                        if (form.is_active !== editingUser.is_active) {
                          payload.is_active = form.is_active;
                        }
                        if (form.password) {
                          payload.password = form.password;
                        }
                        if (form.warehouses.length > 0) {
                          const existingWarehouses = (editingUser.warehouses || []).map(
                            (w) => w.warehouse
                          );
                          const nextWarehouses = [...form.warehouses].sort();
                          const currentWarehouses = [...existingWarehouses].sort();
                          if (nextWarehouses.join('|') !== currentWarehouses.join('|')) {
                            payload.warehouses = form.warehouses;
                          }
                        }
                        if (Object.keys(payload).length === 0) {
                          await refreshUsers();
                          setShowAddModal(false);
                          setShowEditModal(false);
                          setEditingUser(null);
                          resetForm();
                          return;
                        }
                        await apiRequest(
                          `/admin/users/${editingUser.id}`,
                          'PUT',
                          payload,
                          token
                        );
                      } else {
                        await apiRequest(
                          '/admin/users',
                          'POST',
                          {
                            username: form.username,
                            full_name: form.full_name,
                            email: form.email,
                            password: form.password,
                            role: form.role,
                            company: form.company,
                            default_warehouse: form.default_warehouse,
                            source_warehouse: form.source_warehouse,
                            warehouses: form.warehouses
                          },
                          token
                        );
                      }
                      await refreshUsers();
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingUser(null);
                      resetForm();
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-60"
                >
                  {loading ? 'Saving...' : showEditModal ? 'Save Changes' : 'Add User'}
                </button>
              </div>
              {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}
            </div>
          </div>
        )}
      </div>
    </DesktopLayout>
  );
}
