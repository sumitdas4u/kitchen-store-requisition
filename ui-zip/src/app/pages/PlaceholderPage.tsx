import { MobileLayout } from '../components/MobileLayout';
import { DesktopLayout } from '../components/DesktopLayout';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

interface PlaceholderPageProps {
  title: string;
  description?: string;
  layout?: 'mobile-kitchen' | 'mobile-store' | 'desktop';
}

export function PlaceholderPage({ title, description, layout = 'mobile-kitchen' }: PlaceholderPageProps) {
  const navigate = useNavigate();
  
  if (layout === 'desktop') {
    return (
      <DesktopLayout>
        <div className="p-8">
          <h1 className="text-3xl text-gray-900 mb-2">{title}</h1>
          {description && <p className="text-gray-600">{description}</p>}
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">This page is under construction.</p>
          </div>
        </div>
      </DesktopLayout>
    );
  }
  
  const navType = layout === 'mobile-store' ? 'store' : 'kitchen';
  
  return (
    <MobileLayout showNav={false} navType={navType}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl text-gray-900">{title}</h1>
            {description && <p className="text-sm text-gray-500">{description}</p>}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">This page is under construction.</p>
        </div>
      </div>
    </MobileLayout>
  );
}
