// src/components/TokenDisplay.tsx
import React, { useState, useEffect } from 'react';
import { Coins, AlertCircle, TrendingUp, Clock, Crown, Star, Zap, RefreshCw } from 'lucide-react';
import { UserTokens, TokenUsageStats, TOKEN_COSTS } from '../types';
import { tokenService } from '../services/tokenService';
import { TokenUtils } from '../utils/tokenValidationMiddleware';
import { useTokens } from '../hooks/useTokens';

interface TokenDisplayProps {
  userId: string;
  className?: string;
  showDetailed?: boolean;
  onTokenUpdate?: (tokens: UserTokens) => void;
}

export const TokenDisplay: React.FC<TokenDisplayProps> = ({
  userId,
  className = '',
  showDetailed = false,
  onTokenUpdate
}) => {
  // ENHANCED: Use the new useTokens hook for real-time updates
  const {
    userTokens,
    loading,
    error,
    balance,
    tier,
    monthlyAllowance,
    usageThisMonth,
    daysUntilReset,
    balanceStatus,
    usageStats,
    refreshTokens
  } = useTokens({
    userId,
    autoRefresh: true,
    onBalanceChange: (newBalance, oldBalance) => {
      if (userTokens && onTokenUpdate) {
        onTokenUpdate(userTokens);
      }
    }
  });

  // Manual refresh handler
  const handleRefresh = async () => {
    await refreshTokens();
  };

  const getTierIcon = (tier: UserTokens['tier']) => {
    switch (tier) {
      case 'free': return <Coins className="h-4 w-4 text-slate-500" />;
      case 'creator': return <Star className="h-4 w-4 text-blue-500" />;
      case 'pro': return <Crown className="h-4 w-4 text-purple-500" />;
      default: return <Coins className="h-4 w-4 text-slate-500" />;
    }
  };

  const getTierColor = (tier: UserTokens['tier']) => {
    switch (tier) {
      case 'free': return 'text-slate-600 bg-slate-100';
      case 'creator': return 'text-blue-600 bg-blue-100';
      case 'pro': return 'text-purple-600 bg-purple-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  const getBalanceColor = (balance: number, allowance: number) => {
    const percentage = (balance / allowance) * 100;
    if (percentage > 50) return 'text-green-600';
    if (percentage > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-slate-300 rounded"></div>
          <div className="h-4 w-16 bg-slate-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !userTokens) {
    return (
      <div className={`flex items-center gap-2 text-red-600 ${className}`}>
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">{error || 'Token data unavailable'}</span>
      </div>
    );
  }

  if (!showDetailed) {
    // Compact display
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getTierIcon(userTokens.tier)}
        <span className={`font-medium ${getBalanceColor(userTokens.balance, userTokens.monthly_allowance)}`}>
          {TokenUtils.formatTokenCount(userTokens.balance)}
        </span>
        <span className="text-slate-500 text-sm">
          / {TokenUtils.formatTokenCount(userTokens.monthly_allowance)}
        </span>
        <span className={`text-xs px-2 py-1 rounded-full ${getTierColor(userTokens.tier)}`}>
          {userTokens.tier.charAt(0).toUpperCase() + userTokens.tier.slice(1)}
        </span>
      </div>
    );
  }

  // Detailed display
  return (
    <div className={`bg-white rounded-lg border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getTierIcon(userTokens.tier)}
          <h3 className="font-semibold text-slate-800">Token Balance</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            disabled={loading}
            title="Refresh token balance"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <span className={`text-xs px-2 py-1 rounded-full ${getTierColor(userTokens.tier)}`}>
            {userTokens.tier.charAt(0).toUpperCase() + userTokens.tier.slice(1)} Tier
          </span>
        </div>
      </div>

      {/* Balance Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className={`text-lg font-bold ${getBalanceColor(balance, monthlyAllowance)}`}>
            {balance} tokens
          </span>
          <span className="text-sm text-slate-500">
            of {monthlyAllowance} • {usageThisMonth} used
          </span>
        </div>
        {balanceStatus === 'critical' && (
          <div className="text-xs text-red-600 mb-1">
            ⚠️ Critical balance - consider upgrading
          </div>
        )}
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${
              userTokens.balance > userTokens.monthly_allowance * 0.5 ? 'bg-green-500' :
              userTokens.balance > userTokens.monthly_allowance * 0.2 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min((userTokens.balance / userTokens.monthly_allowance) * 100, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Action Costs */}
      <div className="space-y-2 mb-4">
        <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1">
          <Zap className="h-3 w-3" />
          Action Costs
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(TOKEN_COSTS).map(([action, cost]) => {
            const canAfford = userTokens.balance >= cost;
            const actionName = action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            return (
              <div key={action} className={`flex justify-between p-1 rounded ${canAfford ? 'text-slate-700' : 'text-red-500'}`}>
                <span>{actionName}</span>
                <span className="font-medium">{cost}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Usage Stats */}
      {usageStats && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Usage This Month
          </h4>
          <div className="text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Total Used:</span>
              <span className="font-medium">{usageStats.usageThisMonth}</span>
            </div>
            <div className="flex justify-between">
              <span>Daily Average:</span>
              <span className="font-medium">{usageStats.averageDaily}</span>
            </div>
            {usageStats.daysUntilReset > 0 && (
              <div className="flex justify-between items-center text-xs text-slate-500 mt-1">
                <Clock className="h-3 w-3" />
                <span>Resets in {usageStats.daysUntilReset} days</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Low Balance Warning */}
      {userTokens.balance < userTokens.monthly_allowance * 0.2 && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span className="font-medium">Low token balance</span>
          </div>
          <p className="mt-1">
            Consider upgrading your plan or wait for monthly reset in {usageStats?.daysUntilReset || 'N/A'} days.
          </p>
        </div>
      )}
    </div>
  );
};

// Token Validation Guard Component
interface TokenValidationGuardProps {
  userId: string;
  actionType: keyof typeof TOKEN_COSTS;
  onValidationResult: (result: { canProceed: boolean; cost: number; balance: number; error?: string }) => void;
  children: React.ReactNode;
  className?: string;
}

export const TokenValidationGuard: React.FC<TokenValidationGuardProps> = ({
  userId,
  actionType,
  onValidationResult,
  children,
  className = ''
}) => {
  const [validation, setValidation] = useState<{
    canProceed: boolean;
    cost: number;
    balance: number;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    validateTokens();
  }, [userId, actionType]);

  const validateTokens = async () => {
    try {
      setLoading(true);
      const cost = tokenService.getTokenCost(actionType);
      const tokenValidation = await tokenService.validateTokenBalance(userId, cost);
      
      const result = {
        canProceed: tokenValidation.hasEnoughTokens,
        cost,
        balance: tokenValidation.currentBalance,
        error: tokenValidation.hasEnoughTokens ? undefined : 
          `Insufficient tokens. Need ${cost}, have ${tokenValidation.currentBalance}`
      };
      
      setValidation(result);
      onValidationResult(result);
    } catch (error) {
      const result = {
        canProceed: false,
        cost: TOKEN_COSTS[actionType],
        balance: 0,
        error: 'Failed to validate tokens'
      };
      setValidation(result);
      onValidationResult(result);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (!validation?.canProceed) {
    return (
      <div className={`p-3 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Insufficient Tokens</span>
        </div>
        <p className="text-sm text-red-600 mt-1">
          {validation.error}
        </p>
        <div className="mt-2 text-xs text-red-500">
          Need {validation.cost} tokens • Have {validation.balance} tokens
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {children}
    </div>
  );
};

// Token Cost Preview Component
interface TokenCostPreviewProps {
  actionType: keyof typeof TOKEN_COSTS;
  className?: string;
}

export const TokenCostPreview: React.FC<TokenCostPreviewProps> = ({
  actionType,
  className = ''
}) => {
  const costInfo = TokenUtils.getTokenCostInfo(actionType);

  return (
    <div className={`inline-flex items-center gap-1 text-xs text-slate-600 ${className}`}>
      <Coins className="h-3 w-3" />
      <span>{costInfo.cost} tokens</span>
      <span className="text-slate-400">•</span>
      <span className="text-slate-500">{costInfo.estimatedTime}</span>
    </div>
  );
};