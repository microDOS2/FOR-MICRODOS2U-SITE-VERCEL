import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  pending: '#facc15',
  processing: '#60a5fa',
  shipped: '#a78bfa',
  delivered: '#4ade80',
  cancelled: '#f87171',
};

interface OrderStatusChartProps {
  data: Array<{ status: string; count: number }>;
}

export function OrderStatusChart({ data }: OrderStatusChartProps) {
  const chartData = data.map((d) => ({
    name: d.status.charAt(0).toUpperCase() + d.status.slice(1),
    value: d.count,
    color: STATUS_COLORS[d.status] || '#888',
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={4}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#150f24',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
            }}
          />
          <Legend
            formatter={(value: string) => (
              <span style={{ color: '#ccc', fontSize: '12px' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
