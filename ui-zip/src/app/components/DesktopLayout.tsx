import { LayoutDashboard, ChefHat, Package, Users, Settings, Plug } from 'lucide-react';
import { Link, useLocation } from 'react-router';

interface DesktopLayoutProps {
  children: React.ReactNode;
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
  const location = useLocation();
  
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: ChefHat, label: 'Kitchens', path: '/admin/kitchens' },
    { icon: Package, label: 'Item Groups', path: '/admin/item-groups' },
    { icon: Users, label: 'Users', path: '/admin/users' },
    { icon: Plug, label: 'ERP Integration', path: '/admin/erp' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
  ];
  
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl text-gray-900">Restaurant Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Dashboard</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-orange-50 text-primary'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-gray-200">
          <div className="px-4 py-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Admin User</p>
            <p className="text-xs text-gray-500 mt-0.5">admin@restaurant.com</p>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
