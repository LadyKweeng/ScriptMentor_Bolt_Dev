// src/components/TokenDashboard.tsx
import React, { useState } from 'react';
import { 
  BarChart3, 
  Coins, 
  TrendingUp, 
  Calendar,
  RefreshCw,
  Settings,
  ExternalLink,
  Crown,
  Star,
  Zap,
  Clock,
  Target,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useTokens } from '../hooks/useTokens';
import { useTokenAnalytics } from '../hooks/useTokenAnalytics';
import { UsageChart } from './UsageChart';
import { UsageInsights } from './UsageInsights';
import { UserTokens, TOKEN_COSTS, TIER_LIMITS } from '../types/tokens';

interface TokenDashboardProps {
  userId: string;
  onUpgradeClick?: () => void;
  onManageSubscription?: () => void;
  className?: string;
}

export const TokenDashboard: React.FC<TokenDashboardProps> = ({
  userId,
  onUpgradeClick,
  onManageSubscription,
  className = ''
}) => {
  const [refreshKey, setRefreshKey] = useState(0);

  // Validate userId
  if (!userId || typeof userId !== 'string') {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Authentication Required</h3>
          <p className="text-slate-600">Please sign in to view your token dashboard.</p>
        </div>
      </div>
    );
  }

  // Get token data and analytics
  const {
    userTokens,
    loading: tokensLoading,
    error: tokensError,
    balance,
    tier,
    monthlyAllowance,
    usageThisMonth,
    daysUntilReset,
    balanceStatus,
    refreshTokens
  } = useTokens({
    userId,
    autoRefresh: true,
    refreshInterval: 60000 // 1 minute
  });

  const {
    analytics,
    loading: analyticsLoading,
    error: analyticsError,
    refreshAnalytics,
    isStale
  } = useTokenAnalytics({
    userId,
    autoRefresh: true,
    refreshInterval: 300000 // 5 minutes
  });

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshKey(prev => prev + 1);
    await Promise.all([
      refreshTokens(),
      refreshAnalytics()
    ]);
  };

  // Get tier display info
  const getTierInfo = (tier: UserTokens['tier']) => {
    switch (tier) {
      case 'free':
        return {
          name: 'Free',
          icon: <Coins className="h-5 w-5 text-slate-500" />,
          color: 'text-slate-600',
          bgColor: 'bg-slate-50',
          borderColor: 'border-slate-200'
        };
      case 'creator':
        return {
          name: 'Creator',
          icon: <Star className="h-5 w-5 text-blue-500" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      case 'pro':
        return {
          name: 'Pro',
          icon: <Crown className="h-5 w-5 text-purple-500" />,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200'
        };
    }
  };

  // Calculate usage percentage with safety checks
  const usagePercentage = userTokens && monthlyAllowance > 0
    ? Math.round(((monthlyAllowance - balance) / monthlyAllowance) * 100)
    : 0;

  // Get balance status styling
  const getBalanceStatusStyling = (status: typeof balanceStatus) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const tierInfo = userTokens ? getTierInfo(tier) : null;
  const loading = tokensLoading || analyticsLoading;

  if (tokensError || analyticsError) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Unable to Load Dashboard</h3>
          <p className="text-slate-600 mb-4">
            {tokensError || analyticsError || 'An error occurred while loading your token dashboard.'}
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Dashboard Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-slate-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Token Dashboard</h1>
              <p className="text-slate-600">Monitor your usage and optimize your workflow</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isStale && (
              <div className="flex items-center gap-2 text-yellow-600 text-sm">
                <Clock className="h-4 w-4" />
                <span>Data may be outdated</span>
              </div>
            )}
            
            <button
              onClick={handleRefresh}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {onManageSubscription && (
              <button
                onClick={onManageSubscription}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                <span>Manage</span>
              </button>
            )}
          </div>
        </div>

        {/* Current Status Overview */}
        {userTokens ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Current Balance */}
            <div className={`p-4 rounded-lg border ${getBalanceStatusStyling(balanceStatus)}`}>
              <div className="flex items-center justify-between mb-2">
                <Coins className="h-5 w-5" />
                <span className="text-xs font-medium uppercase tracking-wide">Current Balance</span>
              </div>
              <p className="text-2xl font-bold">{balance || 0}</p>
              <p className="text-sm opacity-75">tokens remaining</p>
            </div>

            {/* Current Tier */}
            {tierInfo && (
              <div className={`p-4 rounded-lg border ${tierInfo.bgColor} ${tierInfo.borderColor}`}>
                <div className="flex items-center justify-between mb-2">
                  {tierInfo.icon}
                  <span className="text-xs font-medium uppercase tracking-wide">Current Tier</span>
                </div>
                <p className={`text-2xl font-bold ${tierInfo.color}`}>{tierInfo.name}</p>
                <p className="text-sm opacity-75">{monthlyAllowance || 0} monthly tokens</p>
              </div>
            )}

            {/* Usage This Month */}
            <div className="p-4 rounded-lg border bg-slate-50 border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="h-5 w-5 text-slate-500" />
                <span className="text-xs font-medium uppercase tracking-wide">Usage This Month</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{usagePercentage}%</p>
              <p className="text-sm text-slate-600">{usageThisMonth || 0} of {monthlyAllowance || 0} used</p>
            </div>

            {/* Reset Timer */}
            <div className="p-4 rounded-lg border bg-slate-50 border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="h-5 w-5 text-slate-500" />
                <span className="text-xs font-medium uppercase tracking-wide">Next Reset</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{daysUntilReset || 0}</p>
              <p className="text-sm text-slate-600">days remaining</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="animate-pulse">
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 bg-slate-100 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {userTokens && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Monthly Usage Progress</span>
              <span className="text-sm text-slate-600">{usagePercentage}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  usagePercentage > 80 ? 'bg-red-500' :
                  usagePercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Action Costs Quick Reference */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="h-6 w-6 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">Action Costs</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(TOKEN_COSTS).map(([action, cost]) => {
            const canAfford = (balance || 0) >= cost;
            const actionName = action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            return (
              <div
                key={action}
                className={`p-3 rounded-lg border text-center ${
                  canAfford 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className={`text-lg font-bold ${
                  canAfford ? 'text-green-700' : 'text-red-700'
                }`}>
                  {cost}
                </div>
                <div className={`text-xs ${
                  canAfford ? 'text-green-600' : 'text-red-600'
                }`}>
                  {actionName}
                </div>
                {canAfford ? (
                  <CheckCircle className="h-3 w-3 text-green-500 mx-auto mt-1" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-red-500 mx-auto mt-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Tier Upgrade Suggestion */}
        {tier === 'free' && onUpgradeClick && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-900">Get 10x More Tokens</p>
                <p className="text-sm text-blue-700">
                  Upgrade to Creator tier for 500 monthly tokens and premium features.
                </p>
              </div>
              <button
                onClick={onUpgradeClick}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                Upgrade
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Usage Chart - Only render if analytics data is available */}
      {analytics && analytics.dailyUsage && (
        <UsageChart
          dailyUsage={analytics.dailyUsage}
          comparison={analytics.comparison}
          onRefresh={handleRefresh}
          loading={loading}
          key={refreshKey}
        />
      )}

      {/* Insights and Recommendations - Only render if analytics data is available */}
      {analytics && (
        <UsageInsights
          insights={analytics.insights || []}
          predictions={analytics.predictions}
          efficiency={analytics.efficiency}
          onUpgradeClick={onUpgradeClick}
        />
      )}

      {/* Loading State for Analytics */}
      {analyticsLoading && !analytics && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-slate-200 rounded w-48"></div>
            <div className="h-64 bg-slate-100 rounded"></div>
          </div>
        </div>
      )}
    </div>
  );
};