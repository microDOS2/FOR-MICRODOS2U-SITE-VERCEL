import { Package, FileText, SearchX, ClipboardList } from 'lucide-react';

interface EmptyStateProps {
  type: 'orders' | 'invoices' | 'search' | 'pending';
  title?: string;
  description?: string;
}

const config = {
  orders: {
    icon: Package,
    defaultTitle: 'No orders yet',
    defaultDescription: 'Purchase orders will appear here once they are created.',
  },
  invoices: {
    icon: FileText,
    defaultTitle: 'No invoices found',
    defaultDescription: 'Invoices will appear here when orders are billed.',
  },
  search: {
    icon: SearchX,
    defaultTitle: 'No results',
    defaultDescription: 'Try adjusting your search or filter criteria.',
  },
  pending: {
    icon: ClipboardList,
    defaultTitle: 'Nothing pending',
    defaultDescription: 'All caught up! Nothing requires your attention.',
  },
};

export function EmptyState({ type, title, description }: EmptyStateProps) {
  const { icon: Icon, defaultTitle, defaultDescription } = config[type];

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-brand-700/50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-300 mb-1">{title || defaultTitle}</h3>
      <p className="text-sm text-gray-500 max-w-xs">{description || defaultDescription}</p>
    </div>
  );
}
