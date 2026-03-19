interface StatusBadgeProps {
  status: 'pending' | 'issued' | 'completed' | 'rejected' | 'waiting';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variants = {
    pending: 'bg-yellow-100 text-yellow-800',
    waiting: 'bg-yellow-100 text-yellow-800',
    issued: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${variants[status]}`}>
      {label}
    </span>
  );
}
