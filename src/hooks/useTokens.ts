// src/hooks/useTokens.ts - FIXED: Infinite loop resolved
import { useState, useEffect, useCallback, useRef } from 'react';
import { tokenService } from '../services/tokenService';
import { 
  UserTokens, 
  TokenUsageStats, 
  TokenValidationResult, 
  TokenUsage,
  TOKEN_COSTS 
} from '../types/tokens';

interface UseTokensResult {
  // Token Data
  userTokens: UserTokens | null;
  loading: boolean;
  error: string | null;
  
  // Real-time Status
  balance: number;
  tier: UserTokens['tier'];
  monthlyAllowance: number;
  usageThisMonth: number;
  daysUntilReset: number;
  
  // Usage Analytics
  usageStats: TokenUsageStats | null;
  
  // Status Indicators
  balancePercentage: number; // Percentage of monthly allowance used
  balanceStatus: 'healthy' | 'warning' | 'critical'; // Color-coded status
  isNearLimit: boolean;
  
  // Actions
  refreshTokens: () => Promise<void>;
  validateAction: (actionType: TokenUsage['action_type']) => Promise<TokenValidationResult>;
  getActionCost: (actionType: TokenUsage['action_type']) => number;
  canAffordAction: (actionType: TokenUsage['action_type']) => boolean;
  
  // Subscription Status
  hasActiveSubscription: boolean;
  subscriptionTier: UserTokens['tier'];
}

interface UseTokensOptions {
  userId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  onBalanceChange?: (newBalance: number, oldBalance: number) => void;
  onCriticalBalance?: (balance: number, threshold: number) => void;
}

export function useTokens(options: UseTokensOptions): UseTokensResult {
  const { 
    userId, 
    autoRefresh = true, 
    refreshInterval = 30000, // 30 seconds
    onBalanceChange,
    onCriticalBalance 
  } = options;

  // State Management
  const [userTokens, setUserTokens] = useState<UserTokens | null>(null);
  const [usageStats, setUsageStats] = useState<TokenUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for avoiding stale closures and infinite loops
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastBalanceRef = useRef<number>(0);
  const isLoadingRef = useRef<boolean>(false);
  
  // FIX: Memoize callback functions to prevent infinite loops
  const onBalanceChangeRef = useRef(onBalanceChange);
  const onCriticalBalanceRef = useRef(onCriticalBalance);
  
  // Update refs when callbacks change
  useEffect(() => {
    onBalanceChangeRef.current = onBalanceChange;
  }, [onBalanceChange]);
  
  useEffect(() => {
    onCriticalBalanceRef.current = onCriticalBalance;
  }, [onCriticalBalance]);

  // Calculate days until monthly reset
  const calculateDaysUntilReset = useCallback((lastResetDate: string): number => {
    const lastReset = new Date(lastResetDate);
    const nextReset = new Date(lastReset);
    nextReset.setMonth(nextReset.getMonth() + 1);
    
    const now = new Date();
    const diffTime = nextReset.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }, []);

  // FIX: Stable refresh function that doesn't recreate unnecessarily
  const refreshTokens = useCallback(async () => {
    if (!userId || isLoadingRef.current) {
      setLoading(false);
      return;
    }
    
    isLoadingRef.current = true;
    
    try {
      setError(null);
      console.log('🔄 Fetching token data for user:', userId);
      
      // Fetch user token data
      const tokens = await tokenService.getUserTokenBalance(userId);
      
      if (tokens) {
        const oldBalance = lastBalanceRef.current;
        const newBalance = tokens.balance;
        
        setUserTokens(tokens);
        lastBalanceRef.current = newBalance;
        
        // Trigger balance change callback using ref
        if (oldBalance !== newBalance && onBalanceChangeRef.current) {
          onBalanceChangeRef.current(newBalance, oldBalance);
        }
        
        // Check for critical balance using ref
        const criticalThreshold = Math.max(10, tokens.monthly_allowance * 0.05); // 5% of allowance or 10 tokens
        if (newBalance <= criticalThreshold && onCriticalBalanceRef.current) {
          onCriticalBalanceRef.current(newBalance, criticalThreshold);
        }
        
        // Fetch usage statistics if available
        try {
          const stats = await tokenService.getUserUsageStats(userId);
          setUsageStats(stats);
        } catch (statsError) {
          console.warn('Could not fetch usage statistics:', statsError);
          // Create basic stats from token data
          setUsageStats({
            totalUsed: tokens.monthly_allowance - tokens.balance,
            usageByAction: {} as Record<TokenUsage['action_type'], number>,
            usageThisMonth: tokens.monthly_allowance - tokens.balance,
            averageDaily: 0,
            daysUntilReset: calculateDaysUntilReset(tokens.last_reset_date)
          });
        }
        
        console.log('✅ Token data fetched successfully:', { balance: newBalance, tier: tokens.tier });
      }
    } catch (err) {
      console.error('❌ Error refreshing tokens:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch token data');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [userId, calculateDaysUntilReset]); // FIX: Only depend on userId and stable functions

  // Validate if user can perform an action
  const validateAction = useCallback(async (actionType: TokenUsage['action_type']): Promise<TokenValidationResult> => {
    if (!userId) {
      return {
        hasEnoughTokens: false,
        currentBalance: 0,
        requiredTokens: TOKEN_COSTS[actionType],
        tier: 'free'
      };
    }

    try {
      const cost = TOKEN_COSTS[actionType];
      return await tokenService.validateTokenBalance(userId, cost);
    } catch (error) {
      console.error('Error validating action:', error);
      return {
        hasEnoughTokens: false,
        currentBalance: userTokens?.balance || 0,
        requiredTokens: TOKEN_COSTS[actionType],
        tier: userTokens?.tier || 'free'
      };
    }
  }, [userId, userTokens]);

  // Get cost for an action
  const getActionCost = useCallback((actionType: TokenUsage['action_type']): number => {
    return TOKEN_COSTS[actionType];
  }, []);

  // Check if user can afford an action (quick check)
  const canAffordAction = useCallback((actionType: TokenUsage['action_type']): boolean => {
    if (!userTokens) return false;
    const cost = TOKEN_COSTS[actionType];
    return userTokens.balance >= cost;
  }, [userTokens]);

  // FIX: Stable useEffect that doesn't recreate unnecessarily
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log('🔍 useTokens useEffect triggered:', {
      userId,
      autoRefresh,
      refreshInterval
    });

    // Initial load
    refreshTokens();

    // Setup auto-refresh if enabled
    if (autoRefresh && refreshInterval > 0) {
      console.log('⏰ Setting up auto-refresh interval:', refreshInterval);
      intervalRef.current = setInterval(() => {
        console.log('🔄 Auto-refresh triggered');
        refreshTokens();
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        console.log('🧹 Cleaning up auto-refresh interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userId, autoRefresh, refreshInterval]); // FIX: Remove refreshTokens from dependencies

  // FIX: Single cleanup effect on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      isLoadingRef.current = false;
    };
  }, []);

  // Computed values
  const balance = userTokens?.balance || 0;
  const tier = userTokens?.tier || 'free';
  const monthlyAllowance = userTokens?.monthly_allowance || 0;
  const usageThisMonth = monthlyAllowance - balance;
  const daysUntilReset = userTokens ? calculateDaysUntilReset(userTokens.last_reset_date) : 0;
  
  // Balance analytics
  const balancePercentage = monthlyAllowance > 0 ? Math.round((usageThisMonth / monthlyAllowance) * 100) : 0;
  const remainingPercentage = 100 - balancePercentage;
  
  // Status indicators
  const balanceStatus: 'healthy' | 'warning' | 'critical' = 
    remainingPercentage > 50 ? 'healthy' :
    remainingPercentage > 20 ? 'warning' : 'critical';
    
  const isNearLimit = remainingPercentage <= 20 || balance <= 10;
  
  // Subscription status
  const hasActiveSubscription = tier !== 'free';
  const subscriptionTier = tier;

  return {
    // Token Data
    userTokens,
    loading,
    error,
    
    // Real-time Status
    balance,
    tier,
    monthlyAllowance,
    usageThisMonth,
    daysUntilReset,
    
    // Usage Analytics
    usageStats,
    
    // Status Indicators
    balancePercentage,
    balanceStatus,
    isNearLimit,
    
    // Actions
    refreshTokens,
    validateAction,
    getActionCost,
    canAffordAction,
    
    // Subscription Status
    hasActiveSubscription,
    subscriptionTier
  };
}

// Convenience hook for basic token balance checking
export function useTokenBalance(userId: string): {
  balance: number;
  loading: boolean;
  canAfford: (actionType: TokenUsage['action_type']) => boolean;
  refresh: () => Promise<void>;
} {
  const { balance, loading, canAffordAction, refreshTokens } = useTokens({ 
    userId,
    autoRefresh: false // Minimal version doesn't auto-refresh
  });

  return {
    balance,
    loading,
    canAfford: canAffordAction,
    refresh: refreshTokens
  };
}

// Hook for critical balance monitoring
export function useTokenAlerts(userId: string, options?: {
  criticalThreshold?: number;
  onCriticalBalance?: () => void;
  onTokensExhausted?: () => void;
}) {
  const { criticalThreshold = 10, onCriticalBalance, onTokensExhausted } = options || {};
  
  const { balance, isNearLimit } = useTokens({
    userId,
    onCriticalBalance: (balance, threshold) => {
      if (balance <= criticalThreshold && onCriticalBalance) {
        onCriticalBalance();
      }
      if (balance === 0 && onTokensExhausted) {
        onTokensExhausted();
      }
    }
  });

  return {
    balance,
    isNearLimit,
    isCritical: balance <= criticalThreshold,
    isExhausted: balance === 0
  };
}