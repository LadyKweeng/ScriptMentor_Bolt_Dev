// src/services/analyticsService.ts
import { supabase } from '../utils/supabaseClient';
import { UserTokens, TokenUsage, TokenTransaction, TOKEN_COSTS } from '../types/tokens';

export interface DailyUsageData {
  date: string;
  total: number;
  single_feedback: number;
  blended_feedback: number;
  chunked_feedback: number;
  rewrite_suggestions: number;
  writer_agent: number;
}

export interface UsageInsight {
  type: 'optimization' | 'warning' | 'recommendation' | 'achievement';
  title: string;
  message: string;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  data?: any;
}

export interface PredictionData {
  projectedMonthEnd: number;
  willExceedAllowance: boolean;
  recommendedTier?: UserTokens['tier'];
  daysToDepletion?: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface AnalyticsData {
  dailyUsage: DailyUsageData[];
  insights: UsageInsight[];
  predictions: PredictionData;
  efficiency: {
    mostEfficientAction: string;
    leastEfficientAction: string;
    averageCostPerUse: number;
    recommendedActions: string[];
  };
  comparison: {
    vsLastMonth: {
      totalUsage: number;
      percentageChange: number;
      trend: 'up' | 'down' | 'stable';
    };
    vsPreviousWeek: {
      dailyAverage: number;
      percentageChange: number;
      trend: 'up' | 'down' | 'stable';
    };
  };
}

class AnalyticsService {
  /**
   * Get comprehensive analytics for the dashboard
   */
  async getAnalyticsData(userId: string): Promise<AnalyticsData> {
    try {
      // Validate userId
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid userId provided');
      }

      const [dailyUsage, userTokens, insights, predictions] = await Promise.all([
        this.getDailyUsageData(userId).catch(error => {
          console.warn('Error fetching daily usage, using empty array:', error);
          return [];
        }),
        this.getUserTokens(userId).catch(error => {
          console.warn('Error fetching user tokens:', error);
          return null;
        }),
        this.generateInsights(userId).catch(error => {
          console.warn('Error generating insights, using empty array:', error);
          return [];
        }),
        this.generatePredictions(userId).catch(error => {
          console.warn('Error generating predictions, using defaults:', error);
          return {
            projectedMonthEnd: 0,
            willExceedAllowance: false,
            confidenceLevel: 'low' as const
          };
        })
      ]);

      const efficiency = await this.calculateEfficiency(userId).catch(error => {
        console.warn('Error calculating efficiency, using defaults:', error);
        return {
          mostEfficientAction: 'single_feedback',
          leastEfficientAction: 'chunked_feedback',
          averageCostPerUse: 0,
          recommendedActions: ['Start using AI features to see efficiency metrics']
        };
      });

      const comparison = await this.calculateComparisons(userId).catch(error => {
        console.warn('Error calculating comparisons, using defaults:', error);
        return {
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
        };
      });

      return {
        dailyUsage: dailyUsage || [],
        insights: insights || [],
        predictions: predictions || {
          projectedMonthEnd: 0,
          willExceedAllowance: false,
          confidenceLevel: 'low'
        },
        efficiency: efficiency || {
          mostEfficientAction: 'single_feedback',
          leastEfficientAction: 'chunked_feedback',
          averageCostPerUse: 0,
          recommendedActions: []
        },
        comparison: comparison || {
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
      };
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      
      // Return safe defaults instead of throwing
      return {
        dailyUsage: [],
        insights: [{
          type: 'warning',
          title: 'Analytics Unavailable',
          message: 'Unable to load usage analytics at this time. Please try again later.',
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
          recommendedActions: ['Analytics will be available after using AI features']
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
      };
    }
  }

  /**
   * Get daily usage data for the last 30 days
   */
  private async getDailyUsageData(userId: string): Promise<DailyUsageData[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: usageData, error } = await supabase
      .from('token_usage')
      .select('tokens_used, action_type, created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date and action type
    const dailyMap = new Map<string, DailyUsageData>();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const dateKey = date.toISOString().split('T')[0];
      
      dailyMap.set(dateKey, {
        date: dateKey,
        total: 0,
        single_feedback: 0,
        blended_feedback: 0,
        chunked_feedback: 0,
        rewrite_suggestions: 0,
        writer_agent: 0
      });
    }

    // Populate with actual usage data with proper validation
    if (usageData && Array.isArray(usageData)) {
      usageData.forEach(record => {
        if (!record || !record.created_at || !record.action_type || typeof record.tokens_used !== 'number') {
          return; // Skip invalid records
        }
        
        try {
          const date = new Date(record.created_at).toISOString().split('T')[0];
          const dayData = dailyMap.get(date);
          
          if (dayData) {
            const actionType = record.action_type as keyof Omit<DailyUsageData, 'date' | 'total'>;
            
            // Validate action type exists in our data structure
            if (actionType in dayData && actionType !== 'date' && actionType !== 'total') {
              dayData[actionType] = (dayData[actionType] || 0) + (record.tokens_used || 0);
              dayData.total = (dayData.total || 0) + (record.tokens_used || 0);
            }
          }
        } catch (error) {
          console.warn('Error processing usage record:', record, error);
        }
      });
    }

    // Ensure all values are numbers and not null/undefined
    const result = Array.from(dailyMap.values()).map(day => ({
      date: day.date || new Date().toISOString().split('T')[0],
      total: day.total || 0,
      single_feedback: day.single_feedback || 0,
      blended_feedback: day.blended_feedback || 0,
      chunked_feedback: day.chunked_feedback || 0,
      rewrite_suggestions: day.rewrite_suggestions || 0,
      writer_agent: day.writer_agent || 0
    }));

    return result;
  }

  /**
   * Generate actionable insights based on usage patterns
   */
  private async generateInsights(userId: string): Promise<UsageInsight[]> {
    const insights: UsageInsight[] = [];
    
    try {
      const userTokens = await this.getUserTokens(userId);
      if (!userTokens) return insights;

      // Get recent usage data
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentUsage } = await supabase
        .from('token_usage')
        .select('tokens_used, action_type, created_at')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString());

      if (!recentUsage) return insights;

      const totalRecentUsage = recentUsage.reduce((sum, record) => sum + record.tokens_used, 0);
      const dailyAverage = totalRecentUsage / 7;
      const usagePercentage = (userTokens.balance / userTokens.monthly_allowance) * 100;

      // Balance insights
      if (usagePercentage < 20) {
        insights.push({
          type: 'warning',
          title: 'Low Token Balance',
          message: `You're running low on tokens (${Math.round(usagePercentage)}% remaining). Consider upgrading or waiting for monthly reset.`,
          actionable: true,
          priority: 'high'
        });
      } else if (usagePercentage < 50) {
        insights.push({
          type: 'optimization',
          title: 'Token Management',
          message: `You have ${Math.round(usagePercentage)}% of your tokens remaining. Great pace for the month!`,
          actionable: false,
          priority: 'medium'
        });
      }

      // Usage pattern insights
      const actionCounts = recentUsage.reduce((acc, record) => {
        acc[record.action_type] = (acc[record.action_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostUsedAction = Object.entries(actionCounts)
        .sort(([,a], [,b]) => b - a)[0];

      if (mostUsedAction && mostUsedAction[1] > 3) {
        const [action, count] = mostUsedAction;
        const actionName = action.replace('_', ' ');
        insights.push({
          type: 'optimization',
          title: 'Feature Usage Pattern',
          message: `You're using ${actionName} frequently (${count} times this week). Consider batching similar work for efficiency.`,
          actionable: true,
          priority: 'low'
        });
      }

      // Tier recommendations
      if (userTokens.tier === 'free' && dailyAverage > 3) {
        insights.push({
          type: 'recommendation',
          title: 'Upgrade Recommendation',
          message: 'Based on your usage patterns, Creator tier would give you 10x more tokens and unlock premium features.',
          actionable: true,
          priority: 'medium'
        });
      }

      // Achievement insights
      if (recentUsage.length >= 5) {
        insights.push({
          type: 'achievement',
          title: 'Active Writer',
          message: 'Great job staying consistent! You\'ve used AI feedback 5+ times this week.',
          actionable: false,
          priority: 'low'
        });
      }

      return insights;

    } catch (error) {
      console.error('Error generating insights:', error);
      return insights;
    }
  }

  /**
   * Generate usage predictions
   */
  private async generatePredictions(userId: string): Promise<PredictionData> {
    try {
      const userTokens = await this.getUserTokens(userId);
      if (!userTokens) {
        return {
          projectedMonthEnd: 0,
          willExceedAllowance: false,
          confidenceLevel: 'low'
        };
      }

      // Get usage data for trend analysis
      const lastReset = new Date(userTokens.last_reset_date);
      const now = new Date();
      const daysSinceReset = Math.max(1, Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)));
      
      const { data: monthlyUsage } = await supabase
        .from('token_usage')
        .select('tokens_used, created_at')
        .eq('user_id', userId)
        .gte('created_at', lastReset.toISOString());

      if (!monthlyUsage || monthlyUsage.length === 0) {
        return {
          projectedMonthEnd: 0,
          willExceedAllowance: false,
          confidenceLevel: 'low'
        };
      }

      const totalUsed = monthlyUsage.reduce((sum, record) => sum + record.tokens_used, 0);
      const dailyAverage = totalUsed / daysSinceReset;

      // Calculate days remaining in current month
      const nextReset = new Date(lastReset);
      nextReset.setMonth(nextReset.getMonth() + 1);
      const daysUntilReset = Math.max(0, Math.floor((nextReset.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      const projectedMonthEnd = Math.round(totalUsed + (dailyAverage * daysUntilReset));
      const willExceedAllowance = projectedMonthEnd > userTokens.monthly_allowance;

      // Determine confidence level based on data consistency
      const recentWeekUsage = monthlyUsage
        .filter(record => {
          const recordDate = new Date(record.created_at);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return recordDate >= weekAgo;
        })
        .reduce((sum, record) => sum + record.tokens_used, 0);

      const weeklyAverage = recentWeekUsage / 7;
      const varianceRatio = Math.abs(dailyAverage - weeklyAverage) / Math.max(dailyAverage, 1);
      
      let confidenceLevel: 'high' | 'medium' | 'low' = 'medium';
      if (varianceRatio < 0.2 && daysSinceReset > 7) confidenceLevel = 'high';
      else if (varianceRatio > 0.5 || daysSinceReset < 3) confidenceLevel = 'low';

      // Recommend tier upgrade if needed
      let recommendedTier: UserTokens['tier'] | undefined;
      if (willExceedAllowance) {
        if (userTokens.tier === 'free' && projectedMonthEnd <= 500) {
          recommendedTier = 'creator';
        } else if (userTokens.tier === 'creator' && projectedMonthEnd <= 1500) {
          recommendedTier = 'pro';
        }
      }

      // Calculate days to depletion if current balance insufficient
      let daysToDepletion: number | undefined;
      if (userTokens.balance < userTokens.monthly_allowance * 0.1 && dailyAverage > 0) {
        daysToDepletion = Math.floor(userTokens.balance / dailyAverage);
      }

      return {
        projectedMonthEnd,
        willExceedAllowance,
        recommendedTier,
        daysToDepletion,
        confidenceLevel
      };

    } catch (error) {
      console.error('Error generating predictions:', error);
      return {
        projectedMonthEnd: 0,
        willExceedAllowance: false,
        confidenceLevel: 'low'
      };
    }
  }

  /**
   * Calculate efficiency metrics
   */
  private async calculateEfficiency(userId: string): Promise<AnalyticsData['efficiency']> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: usageData } = await supabase
      .from('token_usage')
      .select('tokens_used, action_type')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (!usageData || usageData.length === 0) {
      return {
        mostEfficientAction: 'single_feedback',
        leastEfficientAction: 'chunked_feedback',
        averageCostPerUse: 0,
        recommendedActions: ['Try single feedback for quick improvements']
      };
    }

    // Calculate action frequencies and average costs
    const actionStats = Object.entries(TOKEN_COSTS).map(([action, cost]) => {
      const usageCount = usageData.filter(record => record.action_type === action).length;
      const totalTokens = usageData
        .filter(record => record.action_type === action)
        .reduce((sum, record) => sum + record.tokens_used, 0);
      
      return {
        action,
        cost,
        usageCount,
        totalTokens,
        efficiency: usageCount > 0 ? cost / usageCount : Infinity
      };
    });

    const sortedByEfficiency = actionStats
      .filter(stat => stat.usageCount > 0)
      .sort((a, b) => a.efficiency - b.efficiency);

    const mostEfficient = sortedByEfficiency[0]?.action || 'single_feedback';
    const leastEfficient = sortedByEfficiency[sortedByEfficiency.length - 1]?.action || 'chunked_feedback';

    const totalTokens = usageData.reduce((sum, record) => sum + record.tokens_used, 0);
    const averageCostPerUse = totalTokens / usageData.length;

    const recommendedActions = [
      `Use ${mostEfficient.replace('_', ' ')} for cost-effective feedback`,
      'Batch similar work to reduce context switching',
      'Review scripts before requesting feedback to maximize value'
    ];

    return {
      mostEfficientAction: mostEfficient.replace('_', ' '),
      leastEfficientAction: leastEfficient.replace('_', ' '),
      averageCostPerUse: Math.round(averageCostPerUse * 100) / 100,
      recommendedActions
    };
  }

  /**
   * Calculate comparison metrics
   */
  private async calculateComparisons(userId: string): Promise<AnalyticsData['comparison']> {
    const now = new Date();
    
    // Last month comparison
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const { data: lastMonthData } = await supabase
      .from('token_usage')
      .select('tokens_used')
      .eq('user_id', userId)
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());

    // Current month comparison
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const { data: currentMonthData } = await supabase
      .from('token_usage')
      .select('tokens_used')
      .eq('user_id', userId)
      .gte('created_at', currentMonthStart.toISOString());

    // Previous week comparison
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { data: lastWeekData } = await supabase
      .from('token_usage')
      .select('tokens_used')
      .eq('user_id', userId)
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString());

    const { data: currentWeekData } = await supabase
      .from('token_usage')
      .select('tokens_used')
      .eq('user_id', userId)
      .gte('created_at', weekAgo.toISOString());

    // Calculate totals
    const lastMonthTotal = lastMonthData?.reduce((sum, record) => sum + record.tokens_used, 0) || 0;
    const currentMonthTotal = currentMonthData?.reduce((sum, record) => sum + record.tokens_used, 0) || 0;
    const lastWeekTotal = lastWeekData?.reduce((sum, record) => sum + record.tokens_used, 0) || 0;
    const currentWeekTotal = currentWeekData?.reduce((sum, record) => sum + record.tokens_used, 0) || 0;

    // Calculate changes
    const monthlyChange = lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
    const weeklyChange = lastWeekTotal > 0 ? ((currentWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : 0;

    const getTrend = (change: number): 'up' | 'down' | 'stable' => {
      if (Math.abs(change) < 5) return 'stable';
      return change > 0 ? 'up' : 'down';
    };

    return {
      vsLastMonth: {
        totalUsage: currentMonthTotal,
        percentageChange: Math.round(monthlyChange),
        trend: getTrend(monthlyChange)
      },
      vsPreviousWeek: {
        dailyAverage: currentWeekTotal / 7,
        percentageChange: Math.round(weeklyChange),
        trend: getTrend(weeklyChange)
      }
    };
  }

  /**
   * Helper method to get user tokens
   */
  private async getUserTokens(userId: string): Promise<UserTokens | null> {
    const { data, error } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user tokens:', error);
      return null;
    }

    return data;
  }
}

export const analyticsService = new AnalyticsService();