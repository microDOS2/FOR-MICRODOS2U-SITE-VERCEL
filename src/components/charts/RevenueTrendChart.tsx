import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RevenueData {
  month: string;
  revenue: number;
}

interface RevenueTrendChartProps {
  data: RevenueData[];
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="month"
            stroke="#888"
            tick={{ fill: '#888', fontSize: 11 }}
          />
          <YAxis
            stroke="#888"
            tick={{ fill: '#888', fontSize: 11 }}
            tickFormatter={(v: number) => `$${v.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              background: '#150f24',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
            }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#44f80c"
            strokeWidth={2}
            dot={{ fill: '#44f80c', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: '#44f80c' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
