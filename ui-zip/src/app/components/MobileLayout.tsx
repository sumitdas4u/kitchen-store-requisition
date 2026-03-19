import { Home, ClipboardList, History, User } from 'lucide-react';
import { Link, useLocation } from 'react-router';

interface MobileLayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
  navType?: 'kitchen' | 'store';
}

export function MobileLayout({ children, showNav = true, navType = 'kitchen' }: MobileLayoutProps) {
  const location = useLocation();
  
  const kitchenNav = [
    { icon: Home, label: 'Dashboard', path: '/kitchen' },
    { icon: ClipboardList, label: 'Requisitions', path: '/kitchen/requisitions' },
    { icon: History, label: 'History', path: '/kitchen/history' },
    { icon: User, label: 'Profile', path: '/kitchen/profile' },
  ];
  
  const storeNav = [
    { icon: Home, label: 'Dashboard', path: '/store' },
    { icon: ClipboardList, label: 'Requisitions', path: '/store/requisitions' },
    { icon: History, label: 'Issued', path: '/store/issued' },
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
          <div className="max-w-2xl mx-auto grid grid-cols-4 gap-1 px-2 py-2">
            {nav.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
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
