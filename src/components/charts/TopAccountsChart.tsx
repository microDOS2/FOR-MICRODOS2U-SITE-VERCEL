import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AccountData {
  name: string;
  total: number;
}

interface TopAccountsChartProps {
  data: AccountData[];
}

export function TopAccountsChart({ data }: TopAccountsChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            type="number"
            stroke="#888"
            tick={{ fill: '#888', fontSize: 11 }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#888"
            tick={{ fill: '#888', fontSize: 11 }}
            width={120}
          />
          <Tooltip
            contentStyle={{
              background: '#150f24',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
            }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total']}
          />
          <Bar dataKey="total" fill="#9a02d0" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
