'use client';

import { useCallback, useEffect, useState } from 'react';
import { DesktopLayout } from '../DesktopLayout';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';
import {
  RefreshCw, CheckCircle, XCircle, Loader, Clock, Database,
  Package, Layers, Warehouse, Building2, Users, BarChart3
} from 'lucide-react';

type SyncStatusEntry = {
  entity: string;
  record_count: number;
  last_synced: string | null;
  duration_ms: number | null;
  is_running: boolean;
};

type SyncLogEntry = {
  id: number;
  entity: string;
  status: string;
  record_count: number;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

const ENTITY_META: Record<string, { label: string; description: string; icon: any }> = {
  items: { label: 'Items', description: 'All active items from ERPNext', icon: Package },
  item_groups: { label: 'Item Groups', description: 'Product categories / item groups', icon: Layers },
  warehouses: { label: 'Warehouses', description: 'Warehouse locations', icon: Warehouse },
  companies: { label: 'Companies', description: 'Company master data', icon: Building2 },
  suppliers: { label: 'Suppliers', description: 'Supplier / vendor list', icon: Users },
  bin_stock: { label: 'Bin Stock', description: 'Stock levels per warehouse', icon: BarChart3 },
};

function formatTime(d: string | null) {
  if (!d) return 'Never';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDuration(ms: number | null) {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AdminSync() {
  const token = useAuthGuard('/admin/login');
  const [status, setStatus] = useState<SyncStatusEntry[]>([]);
  const [log, setLog] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncAllRunning, setSyncAllRunning] = useState(false);
  const [warehouse, setWarehouse] = useState('');
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const [s, l] = await Promise.all([
        apiRequest<SyncStatusEntry[]>('/admin/sync/status', 'GET', undefined, token),
        apiRequest<SyncLogEntry[]>('/admin/sync/log?limit=30', 'GET', undefined, token)
      ]);
      setStatus(s);
      setLog(l);

      // Extract warehouse list from status or use stored value
      const whEntry = s.find((e) => e.entity === 'warehouses');
      if (whEntry && whEntry.record_count > 0 && warehouses.length === 0) {
        try {
          const whData = await apiRequest<{ name: string }[]>(
            '/erp/warehouses', 'GET', undefined, token
          );
          setWarehouses(whData.map((w) => w.name));
          if (!warehouse && whData.length > 0) setWarehouse(whData[0].name);
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, warehouse, warehouses.length]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const syncEntity = async (entity: string) => {
    if (!token) return;
    setSyncing((prev) => ({ ...prev, [entity]: true }));
    setError('');
    try {
      const body: Record<string, string> = { entity };
      if (entity === 'bin_stock' && warehouse) body.warehouse = warehouse;
      await apiRequest('/admin/sync/trigger', 'POST', body, token);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing((prev) => ({ ...prev, [entity]: false }));
    }
  };

  const syncAll = async () => {
    if (!token) return;
    setSyncAllRunning(true);
    setError('');
    try {
      const body: Record<string, string> = { entity: 'all' };
      if (warehouse) body.warehouse = warehouse;
      await apiRequest('/admin/sync/trigger', 'POST', body, token);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncAllRunning(false);
    }
  };

  if (!token) return null;

  return (
    <DesktopLayout>
      <div className="p-6 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ERP Data Sync</h1>
            <p className="text-sm text-gray-500 mt-1">
              Sync master data from ERPNext to local cache for faster performance
            </p>
          </div>
          <button
            onClick={syncAll}
            disabled={syncAllRunning}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {syncAllRunning ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {syncAllRunning ? 'Syncing All...' : 'Sync All'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Warehouse selector for bin stock */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Warehouse (for Bin Stock sync)
          </label>
          {warehouses.length > 0 ? (
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              {warehouses.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              placeholder="Enter warehouse name (e.g. Main Store - FSRAC)"
              className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          )}
        </div>

        {/* Sync Status Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 animate-spin text-orange-500" />
            <span className="ml-2 text-gray-500">Loading sync status...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {status.map((entry) => {
              const meta = ENTITY_META[entry.entity] || {
                label: entry.entity,
                description: '',
                icon: Database
              };
              const Icon = meta.icon;
              const isSyncing = syncing[entry.entity] || entry.is_running;

              return (
                <div
                  key={entry.entity}
                  className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-50 rounded-lg">
                        <Icon className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{meta.label}</h3>
                        <p className="text-xs text-gray-500">{meta.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Records</span>
                      <span className="font-medium text-gray-900">
                        {entry.record_count.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Last synced</span>
                      <span className="text-gray-700">{formatTime(entry.last_synced)}</span>
                    </div>
                    {entry.duration_ms !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Duration</span>
                        <span className="text-gray-700">{formatDuration(entry.duration_ms)}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => syncEntity(entry.entity)}
                    disabled={isSyncing || (entry.entity === 'bin_stock' && !warehouse)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-gray-50 border border-gray-200 rounded-lg hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {isSyncing ? (
                      <>
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        Sync Now
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Sync Log */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              Sync History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 font-medium text-gray-500">Entity</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Records</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Duration</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Started</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {log.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                      No sync history yet. Click "Sync All" to get started.
                    </td>
                  </tr>
                ) : (
                  log.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {ENTITY_META[entry.entity]?.label || entry.entity}
                      </td>
                      <td className="px-5 py-3">
                        {entry.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" /> Success
                          </span>
                        ) : entry.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <XCircle className="w-3 h-3" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Loader className="w-3 h-3 animate-spin" /> Running
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-700">{entry.record_count.toLocaleString()}</td>
                      <td className="px-5 py-3 text-gray-700">{formatDuration(entry.duration_ms)}</td>
                      <td className="px-5 py-3 text-gray-700">{formatTime(entry.started_at)}</td>
                      <td className="px-5 py-3 text-red-600 text-xs max-w-xs truncate">
                        {entry.error_message || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}
