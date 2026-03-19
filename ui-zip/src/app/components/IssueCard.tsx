import { StatusBadge } from './StatusBadge';
import { ArrowRight } from 'lucide-react';

interface IssueCardProps {
  itemName: string;
  requested: string;
  issued?: string;
  status: 'pending' | 'issued' | 'completed' | 'rejected' | 'waiting';
  kitchenName?: string;
  onClick?: () => void;
}

export function IssueCard({ itemName, requested, issued, status, kitchenName, onClick }: IssueCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-gray-200 rounded-lg p-4 text-left hover:shadow-md transition-all active:scale-98"
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-gray-900">{itemName}</h4>
        <StatusBadge status={status} />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Requested:</span>
          <span className="text-orange-600">{requested}</span>
        </div>
        
        {issued && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Issued:</span>
            <span className="text-green-600">{issued}</span>
          </div>
        )}
        
        {kitchenName && (
          <div className="flex items-center gap-2 text-sm pt-2 border-t border-gray-100">
            <span className="text-gray-500">Kitchen:</span>
            <span className="text-gray-900">{kitchenName}</span>
          </div>
        )}
      </div>
      
      {onClick && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end text-sm text-primary">
          View Details <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      )}
    </button>
  );
}
