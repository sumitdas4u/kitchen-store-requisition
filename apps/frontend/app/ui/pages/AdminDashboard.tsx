'use client';

import { useEffect, useState } from 'react';
import { DesktopLayout } from '../DesktopLayout';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';
import {
  ChefHat, ClipboardList, AlertCircle, Clock, TrendingUp,
  CheckCircle2, Loader, ArrowRight
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Link from 'next/link';

type PendingReq = {
  id: number;
  kitchen_name: string;
  warehouse: string;
  shift: string;
  status: string;
  submitted_at: string | null;
  item_count: number;
};

type RecentActivity = {
  id: number;
  kitchen_name: string;
  status: string;
  shift: string;
  item_count: number;
  updated_at: string;
};

type DashboardStats = {
  totalKitchens: number;
  todayRequisitions: number;
  pendingRequisitions: number;
  partiallyIssued: number;
  pendingReqs: PendingReq[];
  consumptionTrend: { day: string; value: number }[];
  topItems: { item: string; usage: number }[];
  recentActivity: RecentActivity[];
};

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function waitingColor(submittedAt: string | null) {
  if (!submittedAt) return 'text-gray-400';
  const hrs = (Date.now() - new Date(submittedAt).getTime()) / 3600000;
  if (hrs > 4) return 'text-red-600 font-semibold';
  if (hrs > 2) return 'text-orange-500 font-medium';
  return 'text-gray-500';
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Submitted: 'bg-blue-100 text-blue-700',
    'Partially Issued': 'bg-yellow-100 text-yellow-700',
    Issued: 'bg-green-100 text-green-700',
    Completed: 'bg-gray-100 text-gray-600',
    Rejected: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export function AdminDashboard() {
  const token = useAuthGuard('/admin/login');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiRequest<DashboardStats>('/admin/dashboard', 'GET', undefined, token)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const kpis = [
    {
      label: 'Total Kitchens',
      value: stats?.totalKitchens ?? '—',
      icon: ChefHat,
      color: 'bg-orange-50 text-orange-600',
    },
    {
      label: "Today's Requisitions",
      value: stats?.todayRequisitions ?? '—',
      icon: ClipboardList,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Pending Issues',
      value: stats ? stats.pendingRequisitions + stats.partiallyIssued : '—',
      icon: AlertCircle,
      color: 'bg-red-50 text-red-600',
      alert: stats ? stats.pendingRequisitions + stats.partiallyIssued > 5 : false,
    },
    {
      label: 'Awaiting Approval',
      value: stats?.pendingRequisitions ?? '—',
      icon: Clock,
      color: 'bg-yellow-50 text-yellow-600',
      alert: stats ? stats.pendingRequisitions > 3 : false,
    },
  ];

  return (
    <DesktopLayout>
      <div className="p-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {loading && <Loader className="w-5 h-5 animate-spin text-gray-400" />}
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-5">
          {kpis.map((kpi, i) => (
            <div
              key={i}
              className={`bg-white rounded-xl border p-5 ${kpi.alert ? 'border-red-200' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${kpi.color}`}>
                  <kpi.icon className="w-5 h-5" />
                </div>
                {kpi.alert && (
                  <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                    Action needed
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold text-gray-900">{String(kpi.value)}</div>
              <div className="text-sm text-gray-500 mt-0.5">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Pending Reqs + Low Stock row */}
        <div className="grid grid-cols-2 gap-6">

          {/* Pending Requisitions Widget */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Pending Requisitions</h3>
              <Link
                href="/admin/requisitions"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-36 text-gray-400">
                <Loader className="w-5 h-5 animate-spin mr-2" /> Loading...
              </div>
            ) : !stats?.pendingReqs.length ? (
              <div className="flex items-center justify-center h-36 gap-2 text-gray-400 text-sm">
                <CheckCircle2 className="w-5 h-5 text-green-500" /> All clear — no pending requisitions
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {stats.pendingReqs.map((req) => (
                  <div key={req.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{req.kitchen_name}</span>
                        {statusBadge(req.status)}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {req.shift} · {req.item_count} items · {req.warehouse}
                      </div>
                    </div>
                    <span className={`text-xs whitespace-nowrap ${waitingColor(req.submitted_at)}`}>
                      {timeAgo(req.submitted_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-medium text-gray-900">Recent Activity</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-36 text-gray-400">
                <Loader className="w-5 h-5 animate-spin mr-2" /> Loading...
              </div>
            ) : !stats?.recentActivity.length ? (
              <div className="flex items-center justify-center h-36 text-gray-400 text-sm">
                No recent activity
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {stats.recentActivity.map((a) => (
                  <div key={a.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{a.kitchen_name}</span>
                        {statusBadge(a.status)}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {a.shift} · {a.item_count} items
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-3">
                      {timeAgo(a.updated_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">

          {/* Daily Consumption Trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-medium text-gray-900">Daily Consumption Trend</h3>
              <span className="text-xs text-gray-400 ml-auto">Last 7 days</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-52 text-gray-400">
                <Loader className="w-5 h-5 animate-spin mr-2" /> Loading...
              </div>
            ) : !stats?.consumptionTrend.length ? (
              <div className="flex items-center justify-center h-52 text-gray-400 text-sm">
                No completed requisitions in last 7 days
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.consumptionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="day"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                  />
                  <Line type="monotone" dataKey="value" stroke="#FF6B00" strokeWidth={2} dot={{ r: 3 }} name="Qty Issued" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <h3 className="font-medium text-gray-900">Top Items by Usage</h3>
              <span className="text-xs text-gray-400 ml-auto">Last 30 days</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-52 text-gray-400">
                <Loader className="w-5 h-5 animate-spin mr-2" /> Loading...
              </div>
            ) : !stats?.topItems.length ? (
              <div className="flex items-center justify-center h-52 text-gray-400 text-sm">
                No usage data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.topItems} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="item"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    width={100}
                  />
                  <Tooltip />
                  <Bar dataKey="usage" fill="#FF6B00" radius={[0, 4, 4, 0]} name="Qty" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </DesktopLayout>
  );
}
