// src/components/TokenBalance.tsx
import React, { useState, useEffect } from 'react';
import { Zap, RefreshCw, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { SubscriptionService } from '../services/subscriptionService';
import { UserTokenBalance } from '../types/subscription';
import { supabase } from '../utils/supabaseClient';

interface TokenBalanceProps {
  userId: string;
  onUpgrade?: () => void;
  compact?: boolean;
}

const TokenBalance: React.FC<TokenBalanceProps> = ({ userId, onUpgrade, compact = false }) => {
  const [tokenBalance, setTokenBalance] = useState<UserTokenBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadTokenBalance();
  }, [userId]);

  const loadTokenBalance = async () => {
    try {
      const balance = await SubscriptionService.getUserTokenBalance(userId);
      setTokenBalance(balance);
    } catch (error) {
      console.error('Error loading token balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTokenBalance();
    setIsRefreshing(false);
  };

  const getBalanceColor = (remaining: number, total: number) => {
    const percentage = (remaining / total) * 100;
    if (percentage > 50) return 'text-green-400';
    if (percentage > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProgressColor = (remaining: number, total: number) => {
    const percentage = (remaining / total) * 100;
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatResetDate = (date: Date) => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Resets today';
    if (diffDays === 1) return 'Resets tomorrow';
    return `Resets in ${diffDays} days`;
  };

  if (isLoading) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} bg-slate-800 rounded-lg border border-slate-700`}>
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-yellow-400"></div>
          <span className="text-slate-400 text-sm">Loading tokens...</span>
        </div>
      </div>
    );
  }

  if (!tokenBalance) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} bg-slate-800 rounded-lg border border-slate-700`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Unable to load token balance</span>
        </div>
      </div>
    );
  }

  const progressPercentage = (tokenBalance.remainingTokens / tokenBalance.totalTokens) * 100;
  const isLowBalance = progressPercentage < 20;

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700">
        <Zap className={`h-4 w-4 ${getBalanceColor(tokenBalance.remainingTokens, tokenBalance.totalTokens)}`} />
        <span className={`text-sm font-medium ${getBalanceColor(tokenBalance.remainingTokens, tokenBalance.totalTokens)}`}>
          {tokenBalance.remainingTokens}
        </span>
        <span className="text-xs text-slate-400">/ {tokenBalance.totalTokens}</span>
        {isLowBalance && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded transition-colors"
          >
            Upgrade
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-400" />
          <h3 className="font-medium text-white">AI Tokens</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title="Refresh balance"
          >
            <RefreshCw className={`h-4 w-4 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {onUpgrade && (
            <button
              onClick={onUpgrade}
              className="flex items-center gap-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded transition-colors"
            >
              <TrendingUp className="h-3 w-3" />
              Upgrade
            </button>
          )}
        </div>
      </div>

      {/* Token Balance Display */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-2xl font-bold ${getBalanceColor(tokenBalance.remainingTokens, tokenBalance.totalTokens)}`}>
            {tokenBalance.remainingTokens}
          </span>
          <span className="text-slate-400">/ {tokenBalance.totalTokens} tokens</span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${getProgressColor(tokenBalance.remainingTokens, tokenBalance.totalTokens)}`}
            style={{ width: `${Math.max(progressPercentage, 2)}%` }}
          />
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-medium text-white">{tokenBalance.usedTokens}</div>
          <div className="text-xs text-slate-400">Used this period</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-medium text-white">
            {Math.round((tokenBalance.usedTokens / tokenBalance.totalTokens) * 100)}%
          </div>
          <div className="text-xs text-slate-400">Usage rate</div>
        </div>
      </div>

      {/* Reset Date */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Clock className="h-4 w-4" />
        <span>{formatResetDate(tokenBalance.resetDate)}</span>
      </div>

      {/* Subscription Tier */}
      <div className="mt-3 pt-3 border-t border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Current Plan</span>
          <span className="text-sm font-medium text-white capitalize">
            {tokenBalance.subscriptionTier}
          </span>
        </div>
      </div>

      {/* Low Balance Warning */}
      {isLowBalance && (
        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Low token balance - consider upgrading to continue using AI features</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenBalance;