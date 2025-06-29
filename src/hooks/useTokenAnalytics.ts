// src/hooks/useTokenAnalytics.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { analyticsService, AnalyticsData } from '../services/analyticsService';

interface UseTokenAnalyticsOptions {
  userId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  onDataUpdate?: (data: AnalyticsData) => void;
  onError?: (error: string) => void;
}

interface UseTokenAnalyticsResult {
  analytics: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshAnalytics: () => Promise<void>;
  isStale: boolean; // Data is older than refresh interval
}

export function useTokenAnalytics(options: UseTokenAnalyticsOptions): UseTokenAnalyticsResult {
  const {
    userId,
    autoRefresh = true,
    refreshInterval = 300000, // 5 minutes default
    onDataUpdate,
    onError
  } = options;

  // State
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refs to prevent stale closures
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef<boolean>(false);
  const onDataUpdateRef = useRef(onDataUpdate);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onDataUpdateRef.current = onDataUpdate;
  }, [onDataUpdate]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Calculate if data is stale
  const isStale = lastUpdated 
    ? Date.now() - lastUpdated.getTime() > refreshInterval 
    : true;

  // Core fetch function
  const fetchAnalytics = useCallback(async (): Promise<void> => {
    if (!userId || isLoadingRef.current) return;

    // Validate userId format
    if (typeof userId !== 'string' || userId.length === 0) {
      console.warn('Invalid userId provided to analytics hook:', userId);
      setError('Invalid user ID');
      setLoading(false);
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      setError(null);

      console.log('🔄 Fetching analytics data for user:', userId);

      const data = await analyticsService.getAnalyticsData(userId);
      
      // Validate the returned data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid analytics data received');
      }

      // Ensure required properties exist with defaults
      const validatedData = {
        dailyUsage: Array.isArray(data.dailyUsage) ? data.dailyUsage : [],
        insights: Array.isArray(data.insights) ? data.insights : [],
        predictions: data.predictions || {
          projectedMonthEnd: 0,
          willExceedAllowance: false,
          confidenceLevel: 'low' as const
        },
        efficiency: data.efficiency || {
          mostEfficientAction: 'single_feedback',
          leastEfficientAction: 'chunked_feedback',
          averageCostPerUse: 0,
          recommendedActions: []
        },
        comparison: data.comparison || {
          vsLastMonth: {
            totalUsage: 0,
            percentageChange: 0,
            trend: 'stable' as const
          },
          vsPreviousWeek: {
            dailyAverage: 0,
            percentageChange: 0,
            trend: 'stable' as const
          }
        }
      };
      
      setAnalytics(validatedData);
      setLastUpdated(new Date());
      
      // Call update callback if provided
      if (onDataUpdateRef.current) {
        onDataUpdateRef.current(validatedData);
      }

      console.log('✅ Analytics data updated successfully');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
      console.error('❌ Error fetching analytics:', err);
      
      setError(errorMessage);
      
      // Set empty analytics on error to prevent UI crashes
      setAnalytics({
        dailyUsage: [],
        insights: [{
          type: 'warning',
          title: 'Data Unavailable',
          message: errorMessage,
          actionable: false,
          priority: 'low'
        }],
        predictions: {
          projectedMonthEnd: 0,
          willExceedAllowance: false,
          confidenceLevel: 'low'
        },
        efficiency: {
          mostEfficientAction: 'single_feedback',
          leastEfficientAction: 'chunked_feedback',
          averageCostPerUse: 0,
          recommendedActions: ['Please try again later']
        },
        comparison: {
          vsLastMonth: {
            totalUsage: 0,
            percentageChange: 0,
            trend: 'stable'
          },
          vsPreviousWeek: {
            dailyAverage: 0,
            percentageChange: 0,
            trend: 'stable'
          }
        }
      });
      
      // Call error callback if provided
      if (onErrorRef.current) {
        onErrorRef.current(errorMessage);
      }
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [userId]);

  // Public refresh function
  const refreshAnalytics = useCallback(async (): Promise<void> => {
    await fetchAnalytics();
  }, [fetchAnalytics]);

  // Setup auto-refresh interval
  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchAnalytics();

    // Setup auto-refresh if enabled
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (!isLoadingRef.current) {
          console.log('🔄 Auto-refreshing analytics data');
          fetchAnalytics();
        }
      }, refreshInterval);
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userId, autoRefresh, refreshInterval, fetchAnalytics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isLoadingRef.current = false;
    };
  }, []);

  // Reset state when userId changes
  useEffect(() => {
    if (userId) {
      setAnalytics(null);
      setError(null);
      setLastUpdated(null);
    }
  }, [userId]);

  return {
    analytics,
    loading,
    error,
    lastUpdated,
    refreshAnalytics,
    isStale
  };
}

// Utility hook for specific analytics data
export function useUsageInsights(userId: string) {
  const { analytics, loading, error } = useTokenAnalytics({ 
    userId,
    refreshInterval: 600000 // 10 minutes for insights
  });

  return {
    insights: analytics?.insights || [],
    predictions: analytics?.predictions || null,
    loading,
    error
  };
}

// Utility hook for chart data
export function useUsageChartData(userId: string) {
  const { analytics, loading, error, refreshAnalytics } = useTokenAnalytics({ 
    userId,
    refreshInterval: 180000 // 3 minutes for chart data
  });

  return {
    dailyUsage: analytics?.dailyUsage || [],
    comparison: analytics?.comparison || null,
    loading,
    error,
    refreshData: refreshAnalytics
  };
}

// Utility hook for efficiency metrics
export function useEfficiencyMetrics(userId: string) {
  const { analytics, loading, error } = useTokenAnalytics({ 
    userId,
    refreshInterval: 900000 // 15 minutes for efficiency data
  });

  return {
    efficiency: analytics?.efficiency || null,
    loading,
    error
  };
}