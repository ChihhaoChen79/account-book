import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { Row } from '../lib/stats';
import { fmt } from '../lib/format';

const RAD = Math.PI / 180;

export default function Donut({ rows, total }: { rows: Row[]; total: number }) {
  const data = rows.filter((r) => r.amount > 0);
  if (!data.length) return <div className="sub py-8 text-center">沒有資料</div>;
  return (
    <div>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="category.name" innerRadius="48%" outerRadius="68%" startAngle={90} endAngle={-270}
              stroke="none" isAnimationActive={false}
              label={(p: { cx?: number; cy?: number; midAngle?: number; outerRadius?: number; percent?: number; index?: number }) => {
                if (!p.percent || p.percent < 0.045) return null;
                const r = (p.outerRadius ?? 0) + 18;
                const x = (p.cx ?? 0) + r * Math.cos(-(p.midAngle ?? 0) * RAD);
                const y = (p.cy ?? 0) + r * Math.sin(-(p.midAngle ?? 0) * RAD);
                const row = data[p.index ?? 0];
                return (
                  <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fill="currentColor">
                    <tspan x={x} dy="-0.5em">{row.category.emoji} {row.category.name}</tspan>
                    <tspan x={x} dy="1.2em">{(p.percent * 100).toFixed(1)}%</tspan>
                  </text>
                );
              }} labelLine={false}>
              {data.map((r) => <Cell key={r.category.id} fill={r.category.color} />)}
            </Pie>
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize={18} fontWeight={700}>{fmt(total)}</text>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        {data.map((r) => (
          <div key={r.category.id} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: r.category.color }} />
            <span className="truncate">{r.category.emoji} {r.category.name}</span>
            <span className="sub ml-auto">{((r.amount / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
