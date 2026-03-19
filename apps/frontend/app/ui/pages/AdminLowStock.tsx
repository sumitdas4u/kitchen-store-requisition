'use client';

import { useCallback, useEffect, useState } from 'react';
import { DesktopLayout } from '../DesktopLayout';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';
import {
  AlertTriangle, XCircle, TrendingDown, Loader, RefreshCw,
  Download, DatabaseZap, Clock, Info
} from 'lucide-react';

type ErpWarehouse = { name: string };
type ErpCompany = { name: string; company_name?: string };

type LowStockItem = {
  item_code: string;
  item_name: string;
  actual_qty: number;
  stock_uom: string;
  avg_daily_usage: number;
  days_remaining: number | null;
  shortfall: number;
  status: 'out_of_stock' | 'critical' | 'low';
};

type SyncInfo = {
  last_synced: string | null;
  row_count: number;
};

const STATUS_META = {
  out_of_stock: {
    label: 'Out of Stock',
    row: 'bg-red-50 border-l-4 border-red-400',
    badge: 'bg-red-100 text-red-700',
    icon: XCircle,
    iconColor: 'text-red-500',
  },
  critical: {
    label: 'Critical',
    row: 'bg-orange-50 border-l-4 border-orange-400',
    badge: 'bg-orange-100 text-orange-700',
    icon: AlertTriangle,
    iconColor: 'text-orange-500',
  },
  low: {
    label: 'Low Stock',
    row: 'bg-yellow-50 border-l-4 border-yellow-400',
    badge: 'bg-yellow-100 text-yellow-700',
    icon: TrendingDown,
    iconColor: 'text-yellow-600',
  },
};

const PERIOD_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
];

function formatSyncTime(d: string | null) {
  if (!d) return 'Never synced';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function exportCsv(items: LowStockItem[], warehouse: string, days: number) {
  const header = ['Item Code', 'Item Name', 'Current Stock', 'UOM', 'Avg Daily Usage', 'Days Remaining', 'Pending Shortfall', 'Status'];
  const rows = items.map((i) => [
    i.item_code,
    `"${i.item_name}"`,
    i.actual_qty,
    i.stock_uom,
    i.avg_daily_usage,
    i.days_remaining ?? 'N/A',
    i.shortfall,
    i.status,
  ]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `low-stock-${warehouse.replace(/[^a-z0-9]/gi, '_')}-${days}d-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

export function AdminLowStock() {
  const token = useAuthGuard('/admin/login');

  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [warehouses, setWarehouses] = useState<ErpWarehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [days, setDays] = useState(30);

  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
  const [syncResult, setSyncResult] = useState<{ synced: number; entries: number } | null>(null);

  // Bootstrap companies + warehouses
  useEffect(() => {
    if (!token) return;
    setLoadingMeta(true);
    apiRequest<ErpCompany[]>('/admin/erp/companies', 'GET', undefined, token)
      .then((c) => {
        setCompanies(c);
        if (c.length > 0) setSelectedCompany(c[0].name);
      })
      .catch(() => {})
      .finally(() => setLoadingMeta(false));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedCompany) return;
    apiRequest<ErpWarehouse[]>(
      `/admin/erp/warehouses?company=${encodeURIComponent(selectedCompany)}`,
      'GET', undefined, token
    )
      .then((w) => {
        setWarehouses(w);
        if (w.length > 0) setSelectedWarehouse(w[0].name);
      })
      .catch(() => setWarehouses([]));
  }, [token, selectedCompany]);

  // Load sync info whenever warehouse changes
  const loadSyncInfo = useCallback((warehouse: string) => {
    if (!token || !warehouse) return;
    apiRequest<SyncInfo>(
      `/admin/low-stock/sync-info?warehouse=${encodeURIComponent(warehouse)}`,
      'GET', undefined, token
    ).then(setSyncInfo).catch(() => {});
  }, [token]);

  useEffect(() => {
    loadSyncInfo(selectedWarehouse);
  }, [selectedWarehouse, loadSyncInfo]);

  const fetchLowStock = useCallback(
    (warehouse: string, periodDays: number) => {
      if (!token || !warehouse) return;
      setLoading(true);
      setItems([]);
      apiRequest<LowStockItem[]>(
        `/admin/low-stock?warehouse=${encodeURIComponent(warehouse)}&days=${periodDays}`,
        'GET', undefined, token
      )
        .then(setItems)
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [token]
  );

  useEffect(() => {
    fetchLowStock(selectedWarehouse, days);
  }, [selectedWarehouse, days, fetchLowStock]);

  const handleSync = async () => {
    if (!token || !selectedWarehouse || syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await apiRequest<{ synced: number; entries: number }>(
        `/admin/low-stock/sync?warehouse=${encodeURIComponent(selectedWarehouse)}`,
        'POST', undefined, token
      );
      setSyncResult(result);
      loadSyncInfo(selectedWarehouse);
      // Reload report after sync
      fetchLowStock(selectedWarehouse, days);
    } catch {
      /* show nothing on error */
    } finally {
      setSyncing(false);
    }
  };

  const counts = {
    out_of_stock: items.filter((i) => i.status === 'out_of_stock').length,
    critical: items.filter((i) => i.status === 'critical').length,
    low: items.filter((i) => i.status === 'low').length,
  };

  return (
    <DesktopLayout>
      <div className="flex flex-col h-screen overflow-hidden">

        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 pt-4 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Low Stock Report</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Avg daily usage from ERP stock entries · items with &lt;7 days of stock
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Summary badges */}
              {!loading && items.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  {counts.out_of_stock > 0 && (
                    <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium text-xs">
                      <XCircle className="w-3 h-3" /> {counts.out_of_stock}
                    </span>
                  )}
                  {counts.critical > 0 && (
                    <span className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium text-xs">
                      <AlertTriangle className="w-3 h-3" /> {counts.critical}
                    </span>
                  )}
                  {counts.low > 0 && (
                    <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full font-medium text-xs">
                      <TrendingDown className="w-3 h-3" /> {counts.low}
                    </span>
                  )}
                </div>
              )}

              {/* Period selector */}
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Company selector */}
              {!loadingMeta && (
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {companies.map((c) => (
                    <option key={c.name} value={c.name}>{c.company_name || c.name}</option>
                  ))}
                </select>
              )}

              {/* Sync button */}
              <button
                onClick={handleSync}
                disabled={syncing || !selectedWarehouse}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                title="Pull latest stock entries from ERP to recalculate avg usage"
              >
                <DatabaseZap className={`w-3.5 h-3.5 ${syncing ? 'animate-pulse' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync ERP'}
              </button>

              {/* Export */}
              {items.length > 0 && (
                <button
                  onClick={() => exportCsv(items, selectedWarehouse, days)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              )}

              <button
                onClick={() => fetchLowStock(selectedWarehouse, days)}
                disabled={loading || !selectedWarehouse}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Sync status bar */}
          {selectedWarehouse && (
            <div className="flex items-center gap-4 py-1.5 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last synced: <span className="text-gray-600 font-medium ml-1">{formatSyncTime(syncInfo?.last_synced ?? null)}</span>
              </span>
              {syncInfo && syncInfo.row_count > 0 && (
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {syncInfo.row_count.toLocaleString()} stock movement lines cached
                </span>
              )}
              {syncResult && (
                <span className="text-green-600 font-medium">
                  ✓ Synced {syncResult.synced} lines from {syncResult.entries} entries
                </span>
              )}
              {syncInfo?.row_count === 0 && !syncing && (
                <span className="text-orange-500 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> No stock data — click Sync ERP to load
                </span>
              )}
            </div>
          )}

          {/* Warehouse tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide mt-1">
            {warehouses.map((wh) => (
              <button
                key={wh.name}
                onClick={() => setSelectedWarehouse(wh.name)}
                className={`px-4 py-2 text-sm whitespace-nowrap rounded-t-lg border-b-2 transition-colors ${
                  selectedWarehouse === wh.name
                    ? 'border-primary text-primary bg-orange-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {wh.name}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingMeta ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader className="w-5 h-5 animate-spin mr-2" /> Loading...
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader className="w-5 h-5 animate-spin mr-2" /> Calculating stock levels...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
              <AlertTriangle className="w-8 h-8 text-green-400" />
              <p className="text-sm font-medium text-green-600">No low stock alerts for this warehouse</p>
              {syncInfo?.row_count === 0 && (
                <p className="text-xs text-orange-500">Tip: click <strong>Sync ERP</strong> to pull stock movement data first</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-3 text-left font-medium text-gray-500 w-6"></th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500">Item</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Current Stock</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500"
                        title={`Average units transferred out per day (last ${days} days from ERP stock entries)`}>
                      Avg Daily ⓘ
                    </th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Days Left</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Pending Need</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Shortfall</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => {
                    const meta = STATUS_META[item.status];
                    const Icon = meta.icon;
                    return (
                      <tr key={item.item_code} className={`${meta.row} hover:brightness-95 transition-all`}>
                        <td className="px-3 py-3">
                          <Icon className={`w-4 h-4 ${meta.iconColor}`} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-900">{item.item_name}</div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">{item.item_code}</div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-semibold ${item.actual_qty <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.actual_qty <= 0 ? '0' : item.actual_qty.toFixed(2)}
                          </span>
                          <span className="text-gray-400 ml-1 text-xs">{item.stock_uom}</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {item.avg_daily_usage > 0 ? (
                            <>
                              <span className="font-medium text-gray-700">{item.avg_daily_usage.toFixed(2)}</span>
                              <span className="text-gray-400 ml-1 text-xs">/day</span>
                            </>
                          ) : (
                            <span className="text-gray-300 text-xs">no data</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {item.days_remaining !== null ? (
                            <span className={`font-bold ${
                              item.days_remaining < 1 ? 'text-red-600' :
                              item.days_remaining < 3 ? 'text-red-500' :
                              item.days_remaining < 7 ? 'text-orange-500' : 'text-gray-700'
                            }`}>
                              {item.days_remaining < 1 ? '<1d' : `${item.days_remaining.toFixed(1)}d`}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {item.shortfall > 0 ? (
                            <>
                              <span className="text-orange-600 font-medium">{item.shortfall.toFixed(2)}</span>
                              <span className="text-gray-400 ml-1 text-xs">{item.stock_uom}</span>
                            </>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {item.shortfall > 0 && item.shortfall > item.actual_qty ? (
                            <span className="text-red-600 font-semibold">
                              -{(item.shortfall - item.actual_qty).toFixed(2)}
                              <span className="text-gray-400 ml-1 text-xs font-normal">{item.stock_uom}</span>
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${meta.badge}`}>
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DesktopLayout>
  );
}
