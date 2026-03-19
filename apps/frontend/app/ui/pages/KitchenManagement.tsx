'use client';

import { useEffect, useState } from 'react';
import { DesktopLayout } from '../DesktopLayout';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';

type ErpWarehouse = { name: string; warehouse_name?: string; parent_warehouse?: string };
type ErpCompany = { name: string; company_name?: string };

export function KitchenManagement() {
  const token = useAuthGuard('/admin/login');
  const [warehouses, setWarehouses] = useState<ErpWarehouse[]>([]);
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');

  useEffect(() => {
    if (!token) {
      return;
    }
    const load = async () => {
      const companiesData = await apiRequest<ErpCompany[]>(
        '/admin/erp/companies',
        'GET',
        undefined,
        token ?? undefined
      );
      setCompanies(companiesData);
      if (!selectedCompany && companiesData.length > 0) {
        setSelectedCompany(companiesData[0].name);
      }
      const data = await apiRequest<ErpWarehouse[]>(
        `/admin/erp/warehouses${selectedCompany ? `?company=${encodeURIComponent(selectedCompany)}` : ''}`,
        'GET',
        undefined,
        token ?? undefined
      );
      setWarehouses(data);
    };
    load().catch(() => setWarehouses([]));
  }, [token, selectedCompany]);

  return (
    <DesktopLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Warehouses</h1>
          <p className="text-gray-600">
            ERPNext warehouses {selectedCompany ? `for ${selectedCompany}` : 'for all companies'}
          </p>
        </div>

        <div className="max-w-md">
          <label className="block text-sm text-gray-700 mb-2">Company Filter</label>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
          >
            <option value="">All companies</option>
            {companies.map((company) => (
              <option key={company.name} value={company.name}>
                {company.company_name || company.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Warehouse</th>
                <th className="text-left px-6 py-4 text-sm text-gray-600">Parent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {warehouses.map((wh) => (
                <tr key={wh.name} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">{wh.warehouse_name || wh.name}</td>
                  <td className="px-6 py-4 text-gray-600">{wh.parent_warehouse || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DesktopLayout>
  );
}
