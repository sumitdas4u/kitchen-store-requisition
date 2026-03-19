'use client';

import { useCallback, useEffect, useState } from 'react';
import { DesktopLayout } from '../DesktopLayout';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';
import { Loader, Download, RefreshCw, TrendingUp, Clock, AlertTriangle, Truck, DollarSign } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConsumptionData = {
  daily: { day: string; value: number }[];
  byKitchen: { kitchen: string; value: number }[];
  topItems: { item_name: string; item_code: string; total_issued: number }[];
};

type AgingData = {
  byWarehouse: { store_warehouse: string; total: number; avg_hours: number; max_hours: number; sla_breaches: number }[];
  distribution: { bucket: string; count: number }[];
};

type WastageData = {
  summary: { total_events: number; total_variance: number };
  rows: { day: string; kitchen: string; item_name: string; item_code: string; uom: string | null; closing_stock: number; actual_closing: number; variance: number }[];
};

type VendorPerf = {
  vendor_id: string; vendor_name: string;
  total_pos: number; total_receipts: number; receipt_rate: number;
  total_ordered_qty: number; total_ordered_value: number;
}[];

type CostData = {
  total: number;
  byVendor: { vendor_name: string; total_value: number; total_lines: number }[];
  byItem: { item_name: string; item_code: string; total_qty: number; total_value: number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultRange() {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { from, to };
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function exportCSV(filename: string, headers: string[], rows: (string | number | null)[]) {
  const lines = [headers.join(','), ...rows.map(String)];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

const CHART_COLORS = ['#FF6B00', '#22C55E', '#3B82F6', '#A855F7', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function DateRangeBar({ from, to, onChange, onRefresh, loading }: {
  from: string; to: string;
  onChange: (f: string, t: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">From</span>
        <input type="date" value={from} onChange={(e) => onChange(e.target.value, to)}
          className="px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">To</span>
        <input type="date" value={to} onChange={(e) => onChange(from, e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
      </div>
      <button onClick={onRefresh} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Run
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-52 text-gray-400">
      <Loader className="w-5 h-5 animate-spin mr-2" /> Loading report...
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-52 text-gray-400 text-sm">{text}</div>
  );
}

// ── 1. Consumption ────────────────────────────────────────────────────────────

function ConsumptionReport({ token }: { token: string }) {
  const def = defaultRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [data, setData] = useState<ConsumptionData | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(() => {
    setLoading(true);
    apiRequest<ConsumptionData>(`/admin/reports/consumption?from=${from}&to=${to}`, 'GET', undefined, token)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [from, to, token]);

  useEffect(() => { run(); }, [run]);

  return (
    <div>
      <DateRangeBar from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} onRefresh={run} loading={loading} />
      {loading ? <LoadingState /> : !data ? null : (
        <div className="space-y-6">
          {/* Daily trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Daily Issued Quantity</h3>
              <button onClick={() => exportCSV('consumption-daily',
                ['Date', 'Total Issued'],
                data.daily.flatMap((r) => [`${r.day},${r.value}`])
              )} className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
            {data.daily.length === 0 ? <EmptyState text="No completed requisitions in this period" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" stroke="#9ca3af" tick={{ fontSize: 11 }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} />
                  <Line type="monotone" dataKey="value" stroke="#FF6B00" strokeWidth={2} dot={{ r: 3 }} name="Qty Issued" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* By Kitchen */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-medium text-gray-900 mb-4">By Kitchen</h3>
              {data.byKitchen.length === 0 ? <EmptyState text="No data" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.byKitchen} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="kitchen" stroke="#9ca3af" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#FF6B00" radius={[0, 4, 4, 0]} name="Qty" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Items table */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Top 20 Items</h3>
                <button onClick={() => exportCSV('consumption-items',
                  ['Item', 'Code', 'Total Issued'],
                  data.topItems.flatMap((r) => [`"${r.item_name}",${r.item_code},${r.total_issued}`])
                )} className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </div>
              <div className="overflow-y-auto max-h-48">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100">
                    <th className="text-left py-1.5 text-gray-500 font-medium">Item</th>
                    <th className="text-right py-1.5 text-gray-500 font-medium">Issued</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.topItems.map((r, i) => (
                      <tr key={r.item_code} className="hover:bg-gray-50">
                        <td className="py-1.5">
                          <span className="text-gray-400 mr-1.5">{i + 1}.</span>
                          <span className="text-gray-900">{r.item_name}</span>
                        </td>
                        <td className="py-1.5 text-right font-medium text-gray-700">{fmt(r.total_issued)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 2. Aging ──────────────────────────────────────────────────────────────────

function AgingReport({ token }: { token: string }) {
  const def = defaultRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(() => {
    setLoading(true);
    apiRequest<AgingData>(`/admin/reports/aging?from=${from}&to=${to}`, 'GET', undefined, token)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [from, to, token]);

  useEffect(() => { run(); }, [run]);

  const totalSLA = data?.byWarehouse.reduce((s, r) => s + r.sla_breaches, 0) ?? 0;

  return (
    <div>
      <DateRangeBar from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} onRefresh={run} loading={loading} />
      {loading ? <LoadingState /> : !data ? null : (
        <div className="space-y-6">
          {/* Summary card */}
          {totalSLA > 0 && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 font-medium">{totalSLA} SLA breach{totalSLA !== 1 ? 'es' : ''} in this period (requisitions taking &gt;4 hours to issue)</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Distribution */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-medium text-gray-900 mb-4">Issue Time Distribution</h3>
              {data.distribution.length === 0 ? <EmptyState text="No issued requisitions in this period" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="bucket" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Requisitions" radius={[4, 4, 0, 0]}>
                      {data.distribution.map((entry) => (
                        <Cell key={entry.bucket}
                          fill={entry.bucket.startsWith('>') ? '#EF4444' : entry.bucket.startsWith('2') ? '#F59E0B' : '#22C55E'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By warehouse table */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">By Store Warehouse</h3>
                <button onClick={() => exportCSV('aging',
                  ['Store Warehouse', 'Total', 'Avg Hours', 'Max Hours', 'SLA Breaches'],
                  data.byWarehouse.flatMap((r) =>
                    [`"${r.store_warehouse}",${r.total},${r.avg_hours},${r.max_hours},${r.sla_breaches}`])
                )} className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </div>
              {data.byWarehouse.length === 0 ? <EmptyState text="No data" /> : (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100">
                    <th className="text-left py-1.5 text-gray-500 font-medium">Warehouse</th>
                    <th className="text-right py-1.5 text-gray-500 font-medium">Reqs</th>
                    <th className="text-right py-1.5 text-gray-500 font-medium">Avg</th>
                    <th className="text-right py-1.5 text-gray-500 font-medium">Max</th>
                    <th className="text-right py-1.5 text-gray-500 font-medium">Breaches</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.byWarehouse.map((r) => (
                      <tr key={r.store_warehouse} className="hover:bg-gray-50">
                        <td className="py-1.5 font-medium text-gray-900 truncate max-w-[150px]">{r.store_warehouse}</td>
                        <td className="py-1.5 text-right text-gray-600">{r.total}</td>
                        <td className={`py-1.5 text-right font-medium ${r.avg_hours > 4 ? 'text-red-600' : r.avg_hours > 2 ? 'text-orange-500' : 'text-green-600'}`}>
                          {r.avg_hours.toFixed(1)}h
                        </td>
                        <td className="py-1.5 text-right text-gray-500">{r.max_hours.toFixed(1)}h</td>
                        <td className={`py-1.5 text-right font-semibold ${r.sla_breaches > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {r.sla_breaches}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 3. Wastage ────────────────────────────────────────────────────────────────

function WastageReport({ token }: { token: string }) {
  const def = defaultRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [data, setData] = useState<WastageData | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(() => {
    setLoading(true);
    apiRequest<WastageData>(`/admin/reports/wastage?from=${from}&to=${to}`, 'GET', undefined, token)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [from, to, token]);

  useEffect(() => { run(); }, [run]);

  return (
    <div>
      <DateRangeBar from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} onRefresh={run} loading={loading} />
      {loading ? <LoadingState /> : !data ? null : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 mb-1">Total Variance Events</p>
              <p className="text-3xl font-bold text-gray-900">{fmt(data.summary.total_events)}</p>
              <p className="text-xs text-gray-400 mt-1">Cases where actual ≠ ERP closing stock</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 mb-1">Total Absolute Variance</p>
              <p className="text-3xl font-bold text-orange-600">{fmt(data.summary.total_variance)}</p>
              <p className="text-xs text-gray-400 mt-1">Sum of |closing - actual| across all items</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-900">Variance Detail (top 100 by magnitude)</h3>
              <button onClick={() => exportCSV('wastage',
                ['Date', 'Kitchen', 'Item', 'Code', 'UOM', 'Closing Stock', 'Actual', 'Variance'],
                data.rows.flatMap((r) =>
                  [`${r.day},"${r.kitchen}","${r.item_name}",${r.item_code},${r.uom ?? ''},${r.closing_stock},${r.actual_closing},${r.variance}`])
              )} className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
            {data.rows.length === 0 ? <EmptyState text="No stock variance events in this period" /> : (
              <div className="overflow-y-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Kitchen</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Item</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">ERP Stock</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Actual</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-xs text-gray-500">{r.day}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 truncate max-w-[120px]">{r.kitchen}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900 text-xs">{r.item_name}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-600">{fmt(r.closing_stock)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-600">{fmt(r.actual_closing)}</td>
                        <td className={`px-4 py-2.5 text-right text-xs font-semibold ${r.variance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {r.variance > 0 ? '-' : '+'}{fmt(Math.abs(r.variance))}
                          {r.uom && <span className="text-gray-400 font-normal ml-1">{r.uom}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 4. Vendor Performance ─────────────────────────────────────────────────────

function VendorPerfReport({ token }: { token: string }) {
  const [data, setData] = useState<VendorPerf | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(() => {
    setLoading(true);
    apiRequest<VendorPerf>('/admin/reports/vendor-performance', 'GET', undefined, token)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { run(); }, [run]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">All-time vendor order and receipt data</p>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading ? <LoadingState /> : !data || data.length === 0 ? <EmptyState text="No vendor orders found" /> : (
        <div className="space-y-6">
          {/* Receipt rate chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-medium text-gray-900 mb-4">Receipt Rate by Vendor (%)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.slice(0, 12)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="vendor_name" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Receipt Rate']} />
                <Bar dataKey="receipt_rate" name="Receipt Rate" radius={[4, 4, 0, 0]}>
                  {data.slice(0, 12).map((entry, i) => (
                    <Cell key={i} fill={entry.receipt_rate >= 80 ? '#22C55E' : entry.receipt_rate >= 50 ? '#F59E0B' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-900">All Vendors</h3>
              <button onClick={() => exportCSV('vendor-performance',
                ['Vendor', 'POs Created', 'Receipts', 'Receipt Rate %', 'Total Ordered Value'],
                data.flatMap((r) => [`"${r.vendor_name}",${r.total_pos},${r.total_receipts},${r.receipt_rate},${r.total_ordered_value}`])
              )} className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">POs</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Receipts</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Receipt Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Order Value</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((r) => (
                  <tr key={r.vendor_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.vendor_name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.total_pos}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.total_receipts}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${r.receipt_rate >= 80 ? 'text-green-600' : r.receipt_rate >= 50 ? 'text-orange-500' : 'text-red-600'}`}>
                        {r.receipt_rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCurrency(r.total_ordered_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 5. Cost Summary ───────────────────────────────────────────────────────────

function CostReport({ token }: { token: string }) {
  const def = defaultRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(() => {
    setLoading(true);
    apiRequest<CostData>(`/admin/reports/cost-summary?from=${from}&to=${to}`, 'GET', undefined, token)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [from, to, token]);

  useEffect(() => { run(); }, [run]);

  return (
    <div>
      <DateRangeBar from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} onRefresh={run} loading={loading} />
      {loading ? <LoadingState /> : !data ? null : (
        <div className="space-y-6">
          {/* Total */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 mb-1">Total Purchase Value</p>
            <p className="text-3xl font-bold text-gray-900">{fmtCurrency(data.total)}</p>
            <p className="text-xs text-gray-400 mt-1">Based on vendor order line prices × qty</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* By vendor pie/bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-medium text-gray-900 mb-4">By Vendor</h3>
              {data.byVendor.length === 0 ? <EmptyState text="No orders in this period" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.byVendor} dataKey="total_value" nameKey="vendor_name"
                      cx="50%" cy="50%" outerRadius={80} label={({ vendor_name, percent }) =>
                        `${vendor_name} ${(percent * 100).toFixed(0)}%`}>
                      {data.byVendor.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top items */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Top Items by Cost</h3>
                <button onClick={() => exportCSV('cost-items',
                  ['Item', 'Code', 'Total Qty', 'Total Value'],
                  data.byItem.flatMap((r) => [`"${r.item_name}",${r.item_code},${r.total_qty},${r.total_value}`])
                )} className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </div>
              <div className="overflow-y-auto max-h-48">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100">
                    <th className="text-left py-1.5 text-gray-500 font-medium">Item</th>
                    <th className="text-right py-1.5 text-gray-500 font-medium">Qty</th>
                    <th className="text-right py-1.5 text-gray-500 font-medium">Value</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.byItem.map((r, i) => (
                      <tr key={r.item_code} className="hover:bg-gray-50">
                        <td className="py-1.5">
                          <span className="text-gray-400 mr-1.5">{i + 1}.</span>
                          <span className="text-gray-900">{r.item_name}</span>
                        </td>
                        <td className="py-1.5 text-right text-gray-600">{fmt(r.total_qty)}</td>
                        <td className="py-1.5 text-right font-medium text-gray-900">{fmtCurrency(r.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'consumption', label: 'Consumption', icon: TrendingUp, component: ConsumptionReport },
  { id: 'aging',       label: 'Aging',       icon: Clock,      component: AgingReport },
  { id: 'wastage',     label: 'Wastage',     icon: AlertTriangle, component: WastageReport },
  { id: 'vendor',      label: 'Vendor',      icon: Truck,      component: VendorPerfReport },
  { id: 'cost',        label: 'Cost',        icon: DollarSign, component: CostReport },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminReports() {
  const token = useAuthGuard('/admin/login');
  const [activeTab, setActiveTab] = useState<TabId>('consumption');

  const ActiveComponent = TABS.find((t) => t.id === activeTab)!.component;

  return (
    <DesktopLayout>
      <div className="flex flex-col h-screen overflow-hidden">

        {/* Header + tabs */}
        <div className="bg-white border-b border-gray-200 px-6 pt-4 pb-0 flex-shrink-0">
          <div className="mb-3">
            <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">Analytics and operational insights</p>
          </div>
          <div className="flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap rounded-t-lg border-b-2 transition-colors ${
                    isActive
                      ? 'border-primary text-primary bg-orange-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Report content */}
        <div className="flex-1 overflow-y-auto p-6">
          {token && <ActiveComponent token={token} />}
        </div>
      </div>
    </DesktopLayout>
  );
}
