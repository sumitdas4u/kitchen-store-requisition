'use client';

import { useCallback, useEffect, useState } from 'react';
import { DesktopLayout } from '../DesktopLayout';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';
import {
  Loader, Search, RefreshCw, X, ChevronDown, ChevronRight,
  Users, TrendingUp, DatabaseZap, Clock, Info, AlertTriangle
} from 'lucide-react';

type VendorHistory = {
  vendor_id: string;
  vendor_name: string;
  uom: string | null;
  latest_rate: number;
  latest_date: string;
  history: { date: string; rate: number; qty: number }[];
};

type PriceItem = {
  item_code: string;
  item_name: string;
  vendor_count: number;
  vendors: VendorHistory[];
};

type SyncInfo = {
  last_synced: string | null;
  row_count: number;
};

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatSyncTime(d: string | null) {
  if (!d) return 'Never synced';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function VendorModal({
  item, onClose
}: { item: PriceItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">{item.item_name}</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{item.item_code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {item.vendors.map((vendor) => (
            <div key={vendor.vendor_id} className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-900">{vendor.vendor_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{vendor.vendor_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">₹{Number(vendor.latest_rate).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">
                    {vendor.uom ?? '—'} · last {formatDate(vendor.latest_date)}
                  </p>
                </div>
              </div>

              {vendor.history.length > 0 && (
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Rate</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {vendor.history.map((h, idx) => {
                        const prev = vendor.history[idx + 1];
                        const change = prev ? ((h.rate - prev.rate) / prev.rate) * 100 : null;
                        return (
                          <tr key={idx} className="hover:bg-white transition-colors">
                            <td className="px-3 py-2 text-gray-500">{formatDate(h.date)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-900">
                              ₹{Number(h.rate).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {Number(h.qty).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {change !== null ? (
                                <span className={`font-medium ${change > 0 ? 'text-red-500' : change < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                  {change > 0 ? '+' : ''}{change.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpandedVendors({ vendors }: { vendors: VendorHistory[] }) {
  return (
    <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
      <div className="flex flex-wrap gap-2 pt-2">
        {vendors.map((v) => (
          <div key={v.vendor_id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <span className="text-gray-700 font-medium">{v.vendor_name}</span>
            <span className="text-gray-300">·</span>
            <span className="font-bold text-gray-900">₹{Number(v.latest_rate).toFixed(2)}</span>
            {v.uom && <span className="text-gray-400 text-xs">/{v.uom}</span>}
            <span className="text-gray-300">·</span>
            <span className="text-gray-400 text-xs">{v.history.length} receipts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPrices() {
  const token = useAuthGuard('/admin/login');

  const [items, setItems] = useState<PriceItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<PriceItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
  const [syncResult, setSyncResult] = useState<{ receipts: number; lines: number } | null>(null);

  const loadSyncInfo = useCallback(() => {
    if (!token) return;
    apiRequest<SyncInfo>('/admin/prices/sync-info', 'GET', undefined, token)
      .then(setSyncInfo).catch(() => {});
  }, [token]);

  useEffect(() => {
    loadSyncInfo();
  }, [loadSyncInfo]);

  const fetchHistory = useCallback((q?: string) => {
    if (!token) return;
    setLoading(true);
    const url = q
      ? `/admin/prices/vendor-history?search=${encodeURIComponent(q)}`
      : '/admin/prices/vendor-history';
    apiRequest<PriceItem[]>(url, 'GET', undefined, token)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchHistory(search.trim() || undefined), 300);
    return () => clearTimeout(t);
  }, [search, fetchHistory]);

  const handleSync = async () => {
    if (!token || syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await apiRequest<{ receipts: number; lines: number }>(
        '/admin/prices/sync', 'POST', undefined, token
      );
      setSyncResult(result);
      loadSyncInfo();
      fetchHistory(search.trim() || undefined);
    } catch { /* ignore */ }
    finally { setSyncing(false); }
  };

  const toggleExpand = (code: string) => {
    setExpandedItem((prev) => (prev === code ? null : code));
  };

  return (
    <DesktopLayout>
      <div className="flex flex-col h-screen overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Price Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">Vendor price history from ERPNext purchase receipts</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Sync ERP button */}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                title="Pull purchase receipt data from ERPNext (last 12 months)"
              >
                <DatabaseZap className={`w-3.5 h-3.5 ${syncing ? 'animate-pulse' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync ERP'}
              </button>

              <button
                onClick={() => fetchHistory(search.trim() || undefined)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Sync status bar */}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last synced: <span className="text-gray-600 font-medium ml-1">{formatSyncTime(syncInfo?.last_synced ?? null)}</span>
            </span>
            {syncInfo && syncInfo.row_count > 0 && (
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3" />
                {syncInfo.row_count.toLocaleString()} price lines cached
              </span>
            )}
            {syncResult && (
              <span className="text-green-600 font-medium">
                Synced {syncResult.lines} lines from {syncResult.receipts} receipts
              </span>
            )}
            {syncInfo?.row_count === 0 && !syncing && (
              <span className="text-orange-500 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> No data — click Sync ERP to pull purchase receipts
              </span>
            )}
            {!loading && items.length > 0 && (
              <span>{items.length} items</span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader className="w-5 h-5 animate-spin mr-2" /> Loading price history...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
              <TrendingUp className="w-8 h-8" />
              <p className="text-sm">No purchase price data found</p>
              {syncInfo?.row_count === 0 && (
                <p className="text-xs text-orange-500">Click <strong>Sync ERP</strong> to pull purchase receipt data from ERPNext</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 w-6"></th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Item Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Code</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Vendors</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Best / Latest Rate</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isExpanded = expandedItem === item.item_code;
                    const lowestRate = Math.min(...item.vendors.map((v) => v.latest_rate));
                    const lowestVendor = item.vendors.find((v) => v.latest_rate === lowestRate);
                    return (
                      <>
                        <tr
                          key={item.item_code}
                          onClick={() => toggleExpand(item.item_code)}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${isExpanded ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-3 text-gray-400">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-primary" />
                              : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{item.item_name}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">{item.item_code}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              <Users className="w-3 h-3" /> {item.vendor_count}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {lowestVendor ? (
                              <div>
                                <span className="font-semibold text-gray-900">
                                  ₹{Number(lowestRate).toFixed(2)}
                                </span>
                                {lowestVendor.uom && (
                                  <span className="text-gray-400 text-xs ml-1">/{lowestVendor.uom}</span>
                                )}
                                <span className="text-gray-400 text-xs ml-2">via {lowestVendor.vendor_name}</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setModalItem(item)}
                              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary hover:bg-orange-50 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <TrendingUp className="w-3.5 h-3.5" /> Details
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${item.item_code}-exp`} className="border-b border-gray-100">
                            <td colSpan={6} className="p-0">
                              <ExpandedVendors vendors={item.vendors} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalItem && (
        <VendorModal item={modalItem} onClose={() => setModalItem(null)} />
      )}
    </DesktopLayout>
  );
}
