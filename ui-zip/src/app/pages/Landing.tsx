import { useNavigate } from 'react-router';
import { ChefHat, Package, LayoutDashboard } from 'lucide-react';

export function Landing() {
  const navigate = useNavigate();

  const userTypes = [
    {
      icon: ChefHat,
      title: 'Kitchen Staff',
      description: 'Create and manage requisitions',
      path: '/kitchen/login',
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      icon: Package,
      title: 'Store Manager',
      description: 'Issue inventory to kitchens',
      path: '/store/login',
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
    },
    {
      icon: LayoutDashboard,
      title: 'Administrator',
      description: 'Manage system and ERP integration',
      path: '/admin',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl text-gray-900 mb-3">
            Restaurant Inventory System
          </h1>
          <p className="text-lg text-gray-600">
            Integrated with ERPNext for seamless inventory management
          </p>
        </div>

        {/* User Type Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {userTypes.map((type) => (
            <button
              key={type.path}
              onClick={() => navigate(type.path)}
              className="group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all p-8 text-center border border-gray-200 hover:border-gray-300 active:scale-98"
            >
              <div className={`inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br ${type.color} rounded-2xl mb-6 group-hover:scale-110 transition-transform`}>
                <type.icon className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-xl text-gray-900 mb-3">{type.title}</h2>
              <p className="text-gray-600 mb-6">{type.description}</p>
              
              <div className="inline-flex items-center gap-2 text-primary">
                <span>Get Started</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Features */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
          <div className="p-6">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="text-gray-900 mb-1">Fast & Efficient</h3>
            <p className="text-sm text-gray-600">Large touch controls for quick operations</p>
          </div>
          <div className="p-6">
            <div className="text-3xl mb-2">🔄</div>
            <h3 className="text-gray-900 mb-1">ERP Integrated</h3>
            <p className="text-sm text-gray-600">Seamless sync with ERPNext</p>
          </div>
          <div className="p-6">
            <div className="text-3xl mb-2">📱</div>
            <h3 className="text-gray-900 mb-1">Progressive Web App</h3>
            <p className="text-sm text-gray-600">Works on all devices</p>
          </div>
        </div>
      </div>
    </div>
  );
}
