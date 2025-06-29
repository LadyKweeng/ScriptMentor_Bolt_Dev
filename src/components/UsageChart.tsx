// src/components/UsageChart.tsx - Fixed version with proper null handling
import React, { useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  RefreshCw
} from 'lucide-react';
import { DailyUsageData, AnalyticsData } from '../services/analyticsService';
import { TOKEN_COSTS } from '../types/tokens';

interface UsageChartProps {
  dailyUsage: DailyUsageData[];
  comparison: AnalyticsData['comparison'] | null;
  onRefresh?: () => void;
  loading?: boolean;
  className?: string;
}

type ChartType = 'line' | 'bar' | 'pie';

export const UsageChart: React.FC<UsageChartProps> = ({
  dailyUsage = [], // Default to empty array
  comparison = null,
  onRefresh,
  loading = false,
  className = ''
}) => {
  const [selectedChart, setSelectedChart] = React.useState<ChartType>('line');
  const [timeRange, setTimeRange] = React.useState<'7d' | '14d' | '30d'>('30d');

  // Filter data based on time range with proper validation
  const filteredData = useMemo(() => {
    if (!dailyUsage || dailyUsage.length === 0) {
      return [];
    }
    
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    return dailyUsage.slice(-days).map(day => ({
      // Ensure all required properties exist with defaults
      date: day?.date || new Date().toISOString().split('T')[0],
      total: day?.total || 0,
      single_feedback: day?.single_feedback || 0,
      blended_feedback: day?.blended_feedback || 0,
      chunked_feedback: day?.chunked_feedback || 0,
      rewrite_suggestions: day?.rewrite_suggestions || 0,
      writer_agent: day?.writer_agent || 0
    }));
  }, [dailyUsage, timeRange]);

  // Prepare pie chart data for action distribution with proper validation
  const actionDistribution = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return [];
    }

    const totals = filteredData.reduce((acc, day) => {
      if (!day) return acc;
      
      acc.single_feedback += day.single_feedback || 0;
      acc.blended_feedback += day.blended_feedback || 0;
      acc.chunked_feedback += day.chunked_feedback || 0;
      acc.rewrite_suggestions += day.rewrite_suggestions || 0;
      acc.writer_agent += day.writer_agent || 0;
      return acc;
    }, {
      single_feedback: 0,
      blended_feedback: 0,
      chunked_feedback: 0,
      rewrite_suggestions: 0,
      writer_agent: 0
    });

    return Object.entries(totals)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => ({
        name: key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: value || 0,
        cost: TOKEN_COSTS[key as keyof typeof TOKEN_COSTS] || 0
      }));
  }, [filteredData]);

  // Color scheme for different action types
  const colors = {
    single_feedback: '#3B82F6',      // Blue
    blended_feedback: '#8B5CF6',     // Purple
    chunked_feedback: '#EF4444',     // Red
    rewrite_suggestions: '#10B981',   // Green
    writer_agent: '#F59E0B',         // Amber
    total: '#6B7280'                 // Gray
  };

  const pieColors = ['#3B82F6', '#8B5CF6', '#EF4444', '#10B981', '#F59E0B'];

  // Format date for display with error handling
  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
      return 'N/A';
    }
  };

  // Custom tooltip for charts with null checking
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length || !label) {
      return null;
    }

    return (
      <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
        <p className="font-medium text-slate-900 mb-2">{formatDate(label)}</p>
        {payload.map((entry: any, index: number) => {
          if (!entry) return null;
          
          return (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: entry.color || '#6B7280' }}
                ></div>
                <span className="text-sm text-slate-600">
                  {entry.dataKey ? entry.dataKey.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unknown'}
                </span>
              </div>
              <span className="font-medium text-slate-900">{entry.value || 0}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Get trend indicator with null checking
  const getTrendIndicator = (change: number, trend: 'up' | 'down' | 'stable') => {
    if (trend === 'stable') {
      return <Minus className="h-4 w-4 text-slate-500" />;
    }
    return trend === 'up' 
      ? <TrendingUp className="h-4 w-4 text-green-500" />
      : <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-48 mb-4"></div>
          <div className="h-64 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  // Show empty state if no data
  if (!filteredData || filteredData.length === 0) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="h-6 w-6 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">Usage Analytics</h3>
        </div>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-2">No usage data available</p>
            <p className="text-sm text-slate-400">
              Start using AI features to see your usage analytics.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">Usage Analytics</h3>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['7d', '14d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  timeRange === range
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setSelectedChart('line')}
              className={`p-2 rounded transition-colors ${
                selectedChart === 'line'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LineChartIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSelectedChart('bar')}
              className={`p-2 rounded transition-colors ${
                selectedChart === 'bar'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSelectedChart('pie')}
              className={`p-2 rounded transition-colors ${
                selectedChart === 'pie'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieChartIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Comparison Stats */}
      {comparison && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">vs Last Month</p>
                <p className="text-xl font-semibold text-slate-900">
                  {comparison.vsLastMonth?.totalUsage || 0}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getTrendIndicator(
                  comparison.vsLastMonth?.percentageChange || 0, 
                  comparison.vsLastMonth?.trend || 'stable'
                )}
                <span className={`text-sm font-medium ${
                  comparison.vsLastMonth?.trend === 'up' ? 'text-green-600' :
                  comparison.vsLastMonth?.trend === 'down' ? 'text-red-600' : 'text-slate-600'
                }`}>
                  {Math.abs(comparison.vsLastMonth?.percentageChange || 0)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Daily Average</p>
                <p className="text-xl font-semibold text-slate-900">
                  {Math.round(comparison.vsPreviousWeek?.dailyAverage || 0)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getTrendIndicator(
                  comparison.vsPreviousWeek?.percentageChange || 0, 
                  comparison.vsPreviousWeek?.trend || 'stable'
                )}
                <span className={`text-sm font-medium ${
                  comparison.vsPreviousWeek?.trend === 'up' ? 'text-green-600' :
                  comparison.vsPreviousWeek?.trend === 'down' ? 'text-red-600' : 'text-slate-600'
                }`}>
                  {Math.abs(comparison.vsPreviousWeek?.percentageChange || 0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {selectedChart === 'line' && (
            <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#64748B"
                fontSize={12}
              />
              <YAxis stroke="#64748B" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke={colors.total} 
                strokeWidth={3}
                dot={{ fill: colors.total, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="single_feedback" 
                stroke={colors.single_feedback} 
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="blended_feedback" 
                stroke={colors.blended_feedback} 
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="chunked_feedback" 
                stroke={colors.chunked_feedback} 
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          )}

          {selectedChart === 'bar' && (
            <BarChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                stroke="#64748B"
                fontSize={12}
              />
              <YAxis stroke="#64748B" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="single_feedback" stackId="a" fill={colors.single_feedback} />
              <Bar dataKey="blended_feedback" stackId="a" fill={colors.blended_feedback} />
              <Bar dataKey="chunked_feedback" stackId="a" fill={colors.chunked_feedback} />
              <Bar dataKey="rewrite_suggestions" stackId="a" fill={colors.rewrite_suggestions} />
              <Bar dataKey="writer_agent" stackId="a" fill={colors.writer_agent} />
            </BarChart>
          )}

          {selectedChart === 'pie' && actionDistribution.length > 0 && (
            <PieChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <Pie
                data={actionDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {actionDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any, name: string) => [value || 0, name || 'Unknown']}
                labelStyle={{ color: '#1F2937' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                fontSize={12}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Empty State for Pie Chart */}
      {selectedChart === 'pie' && actionDistribution.length === 0 && (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <PieChartIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No usage data available for the selected time range.</p>
            <p className="text-sm text-slate-400">Start using AI features to see distribution.</p>
          </div>
        </div>
      )}
    </div>
  );
};