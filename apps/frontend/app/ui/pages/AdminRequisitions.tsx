'use client';

import { useCallback, useEffect, useState } from 'react';
import { DesktopLayout } from '../DesktopLayout';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';
import {
  Loader, RefreshCw, Download, X, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertTriangle
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReqItem = {
  id: number;
  item_code: string;
  item_name: string | null;
  uom: string | null;
  requested_qty: number;
  issued_qty: number;
  received_qty: number;
  item_status: string;
};

type Requisition = {
  id: number;
  kitchen_name: string;
  user_id: number;
  warehouse: string;
  source_warehouse: string;
  shift: string;
  status: string;
  requested_date: string;
  submitted_at: string | null;
  issued_at: string | null;
  completed_at: string | null;
  updated_at: string;
  notes: string | null;
  store_note: string | null;
  erp_name: string | null;
  item_count: number;
  items: ReqItem[];
};

type Summary = Record<string, number>;

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_STATUSES = ['All', 'Submitted', 'Partially Issued', 'Issued', 'Disputed', 'Completed', 'Rejected'];

const STATUS_STYLE: Record<string, string> = {
  Submitted:          'bg-blue-100 text-blue-700',
  'Partially Issued': 'bg-yellow-100 text-yellow-700',
  Issued:             'bg-green-100 text-green-700',
  Disputed:           'bg-purple-100 text-purple-700',
  Completed:          'bg-gray-100 text-gray-600',
  Rejected:           'bg-red-100 text-red-600',
  Draft:              'bg-gray-100 text-gray-400',
};

const ITEM_STATUS_STYLE: Record<string, string> = {
  Pending:            'text-gray-400',
  Issued:             'text-green-600',
  'Partially Issued': 'text-yellow-600',
  Rejected:           'text-red-500',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(d: string | null) {
  if (!d) return '—';
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function waitClass(submittedAt: string | null) {
  if (!submittedAt) return 'text-gray-400';
  const hrs = (Date.now() - new Date(submittedAt).getTime()) / 3600000;
  if (hrs > 4) return 'text-red-600 font-semibold';
  if (hrs > 2) return 'text-orange-500 font-medium';
  return 'text-gray-500';
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  req, token, onClose, onResolved
}: {
  req: Requisition;
  token: string;
  onClose: () => void;
  onResolved: (id: number) => void;
}) {
  const [resolving, setResolving] = useState(false);
  const canResolve = ['Submitted', 'Partially Issued', 'Issued', 'Disputed'].includes(req.status);

  const handleResolve = async () => {
    if (!confirm(`Mark requisition #${req.id} as Completed?`)) return;
    setResolving(true);
    try {
      await apiRequest(`/admin/requisitions/${req.id}/resolve`, 'PUT', undefined, token);
      onResolved(req.id);
      onClose();
    } catch {
      alert('Failed to resolve requisition');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">Requisition #{req.id}</h3>
              <StatusBadge status={req.status} />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {req.kitchen_name} · {req.shift} · {req.requested_date} · {req.item_count} items
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Meta strip */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-3 gap-4 text-xs flex-shrink-0">
          <div>
            <span className="text-gray-400">Kitchen Warehouse</span>
            <p className="font-medium text-gray-700 mt-0.5 truncate">{req.warehouse}</p>
          </div>
          <div>
            <span className="text-gray-400">Store Warehouse</span>
            <p className="font-medium text-gray-700 mt-0.5 truncate">{req.source_warehouse}</p>
          </div>
          <div>
            <span className="text-gray-400">Submitted</span>
            <p className={`font-medium mt-0.5 ${waitClass(req.submitted_at)}`}>{timeAgo(req.submitted_at)}</p>
          </div>
          {req.erp_name && (
            <div>
              <span className="text-gray-400">Stock Entry</span>
              <p className="font-medium text-gray-700 mt-0.5">{req.erp_name}</p>
            </div>
          )}
          {req.store_note && (
            <div className="col-span-2">
              <span className="text-gray-400">Store Note</span>
              <p className="font-medium text-gray-700 mt-0.5">{req.store_note}</p>
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Item</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Requested</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Issued</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Received</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {req.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{item.item_name || item.item_code}</div>
                    <div className="text-xs text-gray-400">{item.item_code}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {Number(item.requested_qty).toFixed(2)}
                    <span className="text-gray-400 ml-1 text-xs">{item.uom}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {Number(item.issued_qty) > 0 ? (
                      <span className="text-green-600 font-medium">{Number(item.issued_qty).toFixed(2)}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {Number(item.received_qty) > 0 ? Number(item.received_qty).toFixed(2) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-medium ${ITEM_STATUS_STYLE[item.item_status] ?? 'text-gray-500'}`}>
                      {item.item_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Close
          </button>
          {canResolve && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {resolving ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {resolving ? 'Resolving...' : 'Mark as Completed'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(rows: Requisition[]) {
  const headers = ['ID', 'Kitchen', 'Warehouse', 'Store Warehouse', 'Shift', 'Status', 'Date', 'Items', 'Submitted At', 'ERP Name'];
  const lines = rows.map((r) => [
    r.id, r.kitchen_name, r.warehouse, r.source_warehouse, r.shift,
    r.status, r.requested_date, r.item_count,
    r.submitted_at ? new Date(r.submitted_at).toISOString() : '',
    r.erp_name ?? ''
  ].join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `requisitions-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminRequisitions() {
  const token = useAuthGuard('/admin/login');

  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Requisition | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [shiftFilter, setShiftFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedFilters, setExpandedFilters] = useState(false);

  // Sort
  const [sortCol, setSortCol] = useState<'submitted_at' | 'kitchen_name' | 'item_count'>('submitted_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'All') params.set('status', statusFilter);
    if (shiftFilter !== 'All') params.set('shift', shiftFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);

    Promise.all([
      apiRequest<Requisition[]>(`/admin/requisitions/enhanced?${params}`, 'GET', undefined, token),
      apiRequest<Summary>('/admin/requisitions/summary', 'GET', undefined, token),
    ])
      .then(([data, sum]) => { setReqs(data); setSummary(sum); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, statusFilter, shiftFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleResolved = (id: number) => {
    setReqs((prev) => prev.map((r) => r.id === id ? { ...r, status: 'Completed' } : r));
    setSummary((prev) => ({
      ...prev,
      [reqs.find((r) => r.id === id)?.status ?? '']: Math.max(0, (prev[reqs.find((r) => r.id === id)?.status ?? ''] ?? 1) - 1),
      Completed: (prev['Completed'] ?? 0) + 1
    }));
  };

  const sorted = [...reqs].sort((a, b) => {
    let av: string | number = a[sortCol] ?? '';
    let bv: string | number = b[sortCol] ?? '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: typeof sortCol }) =>
    sortCol === col
      ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />
      : null;

  const totalPending = (summary['Submitted'] ?? 0) + (summary['Partially Issued'] ?? 0);

  return (
    <DesktopLayout>
      <div className="flex flex-col h-screen overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 pt-4 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Requisitions</h1>
              {totalPending > 0 && (
                <p className="text-xs text-orange-600 font-medium mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {totalPending} pending action
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedFilters((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Filters {expandedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => exportCSV(sorted)}
                disabled={sorted.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Status tab strip */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {ALL_STATUSES.map((s) => {
              const count = s === 'All'
                ? Object.values(summary).reduce((a, b) => a + b, 0)
                : summary[s] ?? 0;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 text-sm whitespace-nowrap rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
                    statusFilter === s
                      ? 'border-primary text-primary bg-orange-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {s}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      statusFilter === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Expanded filters */}
          {expandedFilters && (
            <div className="flex items-center gap-4 py-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Shift</span>
                <select
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value)}
                  className="text-sm px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="All">All Shifts</option>
                  <option value="Morning">Morning</option>
                  <option value="Evening">Evening</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-sm px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-sm px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={() => { setShiftFilter('All'); setDateFrom(''); setDateTo(''); }}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader className="w-5 h-5 animate-spin mr-2" /> Loading requisitions...
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
              <Clock className="w-8 h-8" />
              <p className="text-sm">No requisitions found for the selected filters</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3">{sorted.length} requisition{sorted.length !== 1 ? 's' : ''} · Click a row to view details</p>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-medium text-gray-500 w-12">#</th>
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                        onClick={() => toggleSort('kitchen_name')}
                      >
                        Kitchen <SortIcon col="kitchen_name" />
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Shift</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                      <th
                        className="px-4 py-3 text-right font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                        onClick={() => toggleSort('item_count')}
                      >
                        Items <SortIcon col="item_count" />
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                      <th
                        className="px-4 py-3 text-right font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                        onClick={() => toggleSort('submitted_at')}
                      >
                        Wait <SortIcon col="submitted_at" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sorted.map((req) => (
                      <tr
                        key={req.id}
                        onClick={() => setSelected(req)}
                        className="hover:bg-orange-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{req.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{req.kitchen_name}</div>
                          <div className="text-xs text-gray-400 truncate max-w-[180px]">{req.warehouse}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            req.shift === 'Morning' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                          }`}>
                            {req.shift}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{req.requested_date}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700">{req.item_count}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className={`px-4 py-3 text-right text-xs ${waitClass(req.submitted_at)}`}>
                          {timeAgo(req.submitted_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {selected && token && (
        <DetailModal
          req={selected}
          token={token}
          onClose={() => setSelected(null)}
          onResolved={handleResolved}
        />
      )}
    </DesktopLayout>
  );
}
