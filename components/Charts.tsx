
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell, PieChart, Pie
} from 'recharts';

interface ChartProps {
  data: any[];
  type: 'bar' | 'line';
  title: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-sky-100 rounded-lg shadow-xl backdrop-blur-sm">
        <p className="font-bold text-sky-900 mb-1">{label}</p>
        <p className="text-sky-600 font-medium">
          {payload[0].value}{payload[0].dataKey === 'percentage' ? '%' : ''} {payload[0].dataKey === 'percentage' ? 'Completed' : 'Hours'}
        </p>
      </div>
    );
  }
  return null;
};

export const CompletionChart: React.FC<ChartProps> = ({ data, type, title }) => {
  // VetriPathai Sky Blue Theme Colors
  const COLORS = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc'];

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 w-full h-80 transition-all hover:shadow-md">
      <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
        <span className="w-1 h-6 bg-sky-500 rounded-full mr-3" />
        {title}
      </h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={data} margin={{ bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: '#64748b' }}
                angle={-20}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="percentage" radius={[6, 6, 0, 0]} barSize={40}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="percentage"
                stroke="#0284c7"
                strokeWidth={4}
                dot={{ fill: '#0284c7', stroke: '#fff', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, strokeWidth: 0 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
export const CircularChart: React.FC<ChartProps> = ({ data, title }) => {
  const COLORS = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'];

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 w-full h-80 transition-all hover:shadow-md">
      <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
        <span className="w-1 h-6 bg-sky-500 rounded-full mr-3" />
        {title}
      </h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
