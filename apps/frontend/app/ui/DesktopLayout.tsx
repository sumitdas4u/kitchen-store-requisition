'use client';

import { LayoutDashboard, ChefHat, Package, Users, Settings, Plug, LogOut, ClipboardList, AlertTriangle, FileText, DollarSign, FileCheck, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken, getToken } from '../../lib/session';
import { useEffect, useState } from 'react';

interface DesktopLayoutProps {
  children: React.ReactNode;
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [username, setUsername] = useState('Admin');

  useEffect(() => {
    // Decode JWT to get username
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.username) setUsername(payload.username);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleLogout = () => {
    clearToken();
    router.push('/admin/login');
  };
  
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: ClipboardList, label: 'Requisitions', path: '/admin/requisitions' },
    { icon: AlertTriangle, label: 'Low Stock', path: '/admin/low-stock' },
    { icon: DollarSign, label: 'Price Management', path: '/admin/prices' },
    { icon: FileText, label: 'Reports', path: '/admin/reports' },
    { icon: FileCheck, label: 'Stock Entries', path: '/admin/stock-entries' },
    { icon: ChefHat, label: 'Kitchens', path: '/admin/kitchens' },
    { icon: LayoutGrid, label: 'Item Groups', path: '/admin/item-groups' },
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
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
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
          <div className="px-4 py-3 bg-gray-50 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{username}</p>
              <p className="text-xs text-gray-500 mt-0.5">Admin</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
