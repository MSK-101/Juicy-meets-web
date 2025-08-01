import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartData {
  month: string;
  swipes: number;
  videoViews: number;
  coinsUsed: number;
}

interface ChartComponentProps {
  data: ChartData[];
}

export default function ChartComponent({ data }: ChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="month"
          stroke="#6B7280"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#6B7280"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        />
        <Line
          type="monotone"
          dataKey="swipes"
          stroke="#c084fc"
          strokeWidth={3}
          dot={{ fill: '#c084fc', strokeWidth: 1.5, r: 4 }}
          activeDot={{ r: 6, stroke: '#c084fc', strokeWidth: 1 }}
        />
        <Line
          type="monotone"
          dataKey="videoViews"
          stroke="#9333ea"
          strokeWidth={3}
          dot={{ fill: '#9333ea', strokeWidth: 1.5, r: 4 }}
          activeDot={{ r: 6, stroke: '#9333ea', strokeWidth: 1 }}
        />
        <Line
          type="monotone"
          dataKey="coinsUsed"
          stroke="black"
          strokeWidth={3}
          dot={{ fill: 'black', strokeWidth: 1.5, r: 4 }}
          activeDot={{ r: 6, stroke: '#black', strokeWidth: 1 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
