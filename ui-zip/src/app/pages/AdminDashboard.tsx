import { DesktopLayout } from '../components/DesktopLayout';
import { ChefHat, ClipboardList, Package, AlertCircle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function AdminDashboard() {
  const stats = [
    { label: 'Total Kitchens', value: '8', icon: ChefHat, color: 'bg-orange-50 text-orange-600' },
    { label: "Today's Requisitions", value: '24', icon: ClipboardList, color: 'bg-blue-50 text-blue-600' },
    { label: 'Stock Transfers', value: '156', icon: Package, color: 'bg-green-50 text-green-600' },
    { label: 'Pending Issues', value: '5', icon: AlertCircle, color: 'bg-yellow-50 text-yellow-600' },
  ];

  const consumptionData = [
    { day: 'Mon', value: 45 },
    { day: 'Tue', value: 52 },
    { day: 'Wed', value: 48 },
    { day: 'Thu', value: 61 },
    { day: 'Fri', value: 55 },
    { day: 'Sat', value: 67 },
    { day: 'Sun', value: 58 },
  ];

  const itemUsageData = [
    { item: 'Chicken', usage: 45 },
    { item: 'Onion', usage: 38 },
    { item: 'Tomato', usage: 32 },
    { item: 'Paneer', usage: 28 },
    { item: 'Rice', usage: 52 },
  ];

  return (
    <DesktopLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Overview of your restaurant inventory system</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="text-3xl text-gray-900 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          {/* Daily Consumption */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg text-gray-900 mb-6">Daily Consumption Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={consumptionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#FF6B00" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Item Usage */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg text-gray-900 mb-6">Top Item Usage (kg)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={itemUsageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="item" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="usage" fill="#22C55E" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg text-gray-900">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-200">
            <div className="p-6 flex items-center justify-between hover:bg-gray-50">
              <div>
                <h4 className="text-gray-900">Chinese Kitchen</h4>
                <p className="text-sm text-gray-500 mt-1">Submitted requisition for 5 items</p>
              </div>
              <span className="text-sm text-gray-500">2 hours ago</span>
            </div>
            <div className="p-6 flex items-center justify-between hover:bg-gray-50">
              <div>
                <h4 className="text-gray-900">Store Manager</h4>
                <p className="text-sm text-gray-500 mt-1">Issued 12 items to Tandoor Kitchen</p>
              </div>
              <span className="text-sm text-gray-500">3 hours ago</span>
            </div>
            <div className="p-6 flex items-center justify-between hover:bg-gray-50">
              <div>
                <h4 className="text-gray-900">Italian Kitchen</h4>
                <p className="text-sm text-gray-500 mt-1">Requisition approved</p>
              </div>
              <span className="text-sm text-gray-500">5 hours ago</span>
            </div>
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}
