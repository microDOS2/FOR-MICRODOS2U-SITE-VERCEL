import { Users, Store, ShoppingCart, TrendingUp, DollarSign } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  onClick?: () => void;
}

function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, onClick }: StatCardProps) {
  return (
    <div
      className={`bg-[#150f24] rounded-xl border border-white/10 p-6 ${onClick ? 'cursor-pointer hover:border-[#44f80c]/40 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <p className="text-2xl font-bold text-white mb-1">{value}</p>
          <p className="text-gray-500 text-sm">{subtitle}</p>
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trendUp ? 'text-[#44f80c]' : 'text-red-400'}`}>
              <TrendingUp className="w-4 h-4" />
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 bg-[#0a0514] rounded-lg flex items-center justify-center">
          <Icon className="w-6 h-6 text-[#9a02d0]" />
        </div>
      </div>
    </div>
  );
}

interface RegionalStatsProps {
  salesRepCount: number;
  totalAccountCount: number;
  pendingAssignmentCount: number;
  monthlyVolume?: number;
  pendingOrders?: number;
  onCardClick?: (card: 'team' | 'accounts' | 'volume' | 'orders') => void;
}

export function RegionalStats({ salesRepCount, totalAccountCount, pendingAssignmentCount, monthlyVolume = 0, pendingOrders = 0, onCardClick }: RegionalStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Sales Reps"
        value={String(salesRepCount)}
        subtitle="On your team"
        icon={Users}
        trend={salesRepCount > 0 ? "Active team" : "No reps yet"}
        trendUp={salesRepCount > 0}
        onClick={onCardClick ? () => onCardClick('team') : undefined}
      />
      <StatCard
        title="Total Accounts"
        value={String(totalAccountCount)}
        subtitle="Wholesalers & Distributors"
        icon={Store}
        trend={`${pendingAssignmentCount} unassigned`}
        trendUp={pendingAssignmentCount === 0}
        onClick={onCardClick ? () => onCardClick('accounts') : undefined}
      />
      <StatCard
        title="Monthly Volume"
        value={`$${monthlyVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        subtitle="Combined sales"
        icon={DollarSign}
        trend={monthlyVolume > 0 ? "This period" : "No sales yet"}
        trendUp={monthlyVolume > 0}
        onClick={onCardClick ? () => onCardClick('volume') : undefined}
      />
      <StatCard
        title="Pending Orders"
        value={String(pendingOrders)}
        subtitle="Across all accounts"
        icon={ShoppingCart}
        onClick={onCardClick ? () => onCardClick('orders') : undefined}
      />
    </div>
  );
}
