import { ChevronRight } from 'lucide-react';

interface KitchenCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'success';
}

export function KitchenCard({ title, value, subtitle, icon, onClick, variant = 'default' }: KitchenCardProps) {
  const variantStyles = {
    default: 'bg-white border-gray-200',
    primary: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200',
    success: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full border ${variantStyles[variant]} rounded-xl p-5 text-left transition-all hover:shadow-md active:scale-98`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {icon && <div className="text-gray-600">{icon}</div>}
            <h3 className="text-sm text-gray-600">{title}</h3>
          </div>
          <div className="text-2xl text-gray-900 mb-1">{value}</div>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </div>
    </button>
  );
}
