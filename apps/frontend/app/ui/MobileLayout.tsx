'use client';

import { Home, ClipboardList, History, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileLayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
  navType?: 'kitchen' | 'store';
}

export function MobileLayout({ children, showNav = true, navType = 'kitchen' }: MobileLayoutProps) {
  const pathname = usePathname();
  
  const kitchenNav = [
    { icon: Home, label: 'Dashboard', path: '/kitchen' },
  ];
  
  const storeNav = [
    { icon: Home, label: 'Dashboard', path: '/store' },
    { icon: ClipboardList, label: 'Transfers', path: '/store/transfers' },
    { icon: History, label: 'Vendor Orders', path: '/store/vendor-orders' },
    { icon: ClipboardList, label: 'Receipts', path: '/store/purchase-receipts' },
    { icon: User, label: 'Profile', path: '/store/profile' },
  ];
  
  const nav = navType === 'kitchen' ? kitchenNav : storeNav;
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-2xl mx-auto">
        {children}
      </div>
      
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb">
          <div
            className={`max-w-2xl mx-auto grid gap-1 px-2 py-2 ${
              nav.length <= 1 ? 'grid-cols-1' : nav.length === 2 ? 'grid-cols-2' : 'grid-cols-4'
            }`}
          >
            {nav.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors ${
                    isActive 
                      ? 'text-primary bg-orange-50' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-xs">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
