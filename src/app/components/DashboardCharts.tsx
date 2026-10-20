import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts';

export interface DashboardChartsProps {
  serviceVolumeTitle: string;
  chartPeriodSubtitle?: string | null;
  serviceVolumeData: Array<{
    name: string;
    value: number;
    sales?: number;
    breakdown?: Record<string, number>;
  }>;
  timeSeriesData: Array<{
    period: string;
    newOrders: number;
    releasedOrders: number;
  }>;
  chartTitle: string;
  isOwner: boolean;
  ServiceTooltip: React.ComponentType<any>;
  TrendTooltip: React.ComponentType<any>;
}

const TrendCustomTick = (props: any) => {
  const { x, y, payload } = props;
  const value = String(payload?.value || '');
  const isOff = value.includes('(Off)');
  const isSun = value.startsWith('Sun');
  // Shift slightly to the left so that "Sun (Off)" and especially the closing parenthesis ")"
  // has ample margin and is 100% visible inside the card without edge clipping.
  const shiftX = isOff ? -14 : isSun ? -8 : 0;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={shiftX}
        y={0}
        dy={12}
        textAnchor="middle"
        fill="#64748b"
        fontSize={9.5}
        fontWeight={600}
      >
        {value}
      </text>
    </g>
  );
};

export default function DashboardCharts({
  serviceVolumeTitle,
  chartPeriodSubtitle,
  serviceVolumeData,
  timeSeriesData,
  chartTitle,
  isOwner,
  ServiceTooltip,
  TrendTooltip,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
      {/* Service Volume Chart */}
      <Card className="border-none shadow-md bg-white overflow-hidden gap-0">
        <CardHeader className="flex flex-row items-start justify-between pb-1.5 pt-3 sm:pt-4 px-3 sm:px-5 gap-2">
          <div className="flex flex-col text-left min-w-0 pr-1">
            <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-tight text-gray-800 leading-tight">
              {serviceVolumeTitle}
            </CardTitle>
            {chartPeriodSubtitle && (
              <span className="text-[10px] sm:text-[11px] font-bold text-red-700 mt-0.5 tracking-normal leading-tight">
                {chartPeriodSubtitle}
              </span>
            )}
          </div>
          {/* Header Legend: on right side top even on small screens */}
          <div className="grid grid-cols-2 gap-x-2.5 sm:gap-x-4 gap-y-1 text-[7.5px] sm:text-[8.5px] font-bold uppercase tracking-wider text-gray-500 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#A2C2B9] shrink-0 inline-block" />
              <span className="leading-none">BASIC CLEANING</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#93C5FD] shrink-0 inline-block" />
              <span className="leading-none">MINOR REGLUE</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#D69BE5] shrink-0 inline-block" />
              <span className="leading-none">FULL REGLUE</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#F5CD93] shrink-0 inline-block" />
              <span className="leading-none">COLOR RENEWAL</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-3 sm:px-4 pb-1">
          <ResponsiveContainer width="100%" height={175} debounce={50}>
            <BarChart data={serviceVolumeData} margin={{ top: 16, right: 10, left: -15, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9.5, fontWeight: 700, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                dy={3}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <Tooltip content={<ServiceTooltip isOwner={isOwner} />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={48}>
                {serviceVolumeData.map((_item, index) => (
                  <Cell key={`cell-${index}`} fill={['#A2C2B9', '#93C5FD', '#D69BE5', '#F5CD93'][index % 4]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Activity Trend Chart */}
      <Card className="border-none shadow-md bg-white overflow-hidden gap-0">
        <CardHeader className="flex flex-row items-start justify-between pb-1.5 pt-3 sm:pt-4 px-3 sm:px-5 gap-2">
          <div className="flex flex-col text-left min-w-0 pr-1">
            <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-tight text-gray-800 leading-tight">
              {chartTitle}
            </CardTitle>
            {chartPeriodSubtitle && (
              <span className="text-[10px] sm:text-[11px] font-bold text-red-700 mt-0.5 tracking-normal leading-tight">
                {chartPeriodSubtitle}
              </span>
            )}
          </div>
          {/* Header Legend: on right side top even on small screens */}
          <div className="flex flex-row items-center gap-2.5 sm:gap-3.5 text-[7.5px] sm:text-[8.5px] font-bold uppercase tracking-wider text-gray-500 shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#A78BFA] shrink-0 inline-block" />
              <span className="leading-none">ORDERS CREATED</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#F97316] shrink-0 inline-block" />
              <span className="leading-none">ORDERS RELEASED</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-3 sm:px-4 pb-1">
          <ResponsiveContainer width="100%" height={175} debounce={50}>
            <LineChart data={timeSeriesData} margin={{ top: 16, right: 24, left: -15, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="period"
                interval="preserveStartEnd"
                padding={{ left: 12, right: 12 }}
                tick={<TrendCustomTick />}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <Tooltip content={<TrendTooltip />} />
              <Line
                type="linear"
                dataKey="newOrders"
                stroke="#A78BFA"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#A78BFA', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="linear"
                dataKey="releasedOrders"
                stroke="#F97316"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#F97316', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
