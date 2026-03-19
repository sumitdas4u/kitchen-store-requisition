import { MobileLayout } from '../components/MobileLayout';
import { KitchenCard } from '../components/KitchenCard';
import { ClipboardList, Package, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router';

export function StoreDashboard() {
  const navigate = useNavigate();
  
  return (
    <MobileLayout navType="store">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Welcome back</p>
          <h1 className="text-2xl text-gray-900">Central Store</h1>
        </div>

        {/* Quick Stats */}
        <div className="space-y-3">
          <h2 className="text-sm text-gray-500 px-1">Today's Overview</h2>
          
          <KitchenCard
            title="Pending Requisitions"
            value="8"
            subtitle="Waiting for your action"
            icon={<ClipboardList className="w-5 h-5" />}
            variant="primary"
            onClick={() => navigate('/store/requisitions')}
          />
          
          <KitchenCard
            title="Items Issued Today"
            value="24"
            subtitle="Total items processed"
            icon={<Package className="w-5 h-5" />}
            variant="success"
            onClick={() => navigate('/store/issued')}
          />
          
          <KitchenCard
            title="Low Stock Items"
            value="5"
            subtitle="Requires attention"
            icon={<AlertTriangle className="w-5 h-5" />}
            onClick={() => navigate('/store/low-stock')}
          />
        </div>

        {/* Recent Requisitions */}
        <div className="space-y-3">
          <h2 className="text-sm text-gray-500 px-1">Recent Requisitions</h2>
          
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="text-gray-900">Chinese Kitchen</h4>
                <p className="text-sm text-gray-500">5 items requested</p>
              </div>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                Pending
              </span>
            </div>
            <p className="text-sm text-gray-600">Chicken Breast, Onion, Soy Sauce...</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="text-gray-900">Tandoor Kitchen</h4>
                <p className="text-sm text-gray-500">3 items requested</p>
              </div>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                Pending
              </span>
            </div>
            <p className="text-sm text-gray-600">Paneer, Tomato, Cream...</p>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
