import { MobileLayout } from '../components/MobileLayout';
import { KitchenCard } from '../components/KitchenCard';
import { PlusCircle, Clock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router';

export function KitchenDashboard() {
  const navigate = useNavigate();
  
  return (
    <MobileLayout navType="kitchen">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Welcome back</p>
          <h1 className="text-2xl text-gray-900">Chinese Kitchen</h1>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-sm text-gray-500 px-1">Quick Actions</h2>
          
          <KitchenCard
            title="Create New Requisition"
            value="Start Request"
            subtitle="Submit your daily inventory request"
            icon={<PlusCircle className="w-5 h-5" />}
            variant="primary"
            onClick={() => navigate('/kitchen/create-requisition')}
          />
          
          <KitchenCard
            title="Pending Items"
            value="3"
            subtitle="Items awaiting approval"
            icon={<Clock className="w-5 h-5" />}
            onClick={() => navigate('/kitchen/pending')}
          />
          
          <KitchenCard
            title="Received Today"
            value="12"
            subtitle="Items received and accepted"
            icon={<CheckCircle className="w-5 h-5" />}
            variant="success"
            onClick={() => navigate('/kitchen/history')}
          />
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <h2 className="text-sm text-gray-500 px-1">Recent Activity</h2>
          
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="text-gray-900">Morning Requisition</h4>
                <p className="text-sm text-gray-500">Submitted 2 hours ago</p>
              </div>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                Pending
              </span>
            </div>
            <p className="text-sm text-gray-600">5 items requested</p>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
