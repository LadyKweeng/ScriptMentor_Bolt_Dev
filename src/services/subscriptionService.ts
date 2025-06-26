// src/services/subscriptionService.ts
// Comprehensive subscription management service for Script Mentor

import { createClient } from '@supabase/supabase-js';
import { UserTokens, TIER_LIMITS, PRICE_ID_TO_TIER } from '../types/tokens';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface SubscriptionInfo {
  id: string;
  customer_id: string;
  price_id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  trial_end?: number;
  created_at: string;
  updated_at: string;
}

export interface TierFeatureAccess {
  hasAccess: boolean;
  feature: string;
  currentTier: UserTokens['tier'];
  requiredTier: UserTokens['tier'];
  reason?: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  tier: UserTokens['tier'];
  subscription?: SubscriptionInfo;
  nextBillingDate?: Date;
  daysUntilBilling?: number;
  trialStatus?: {
    inTrial: boolean;
    daysRemaining?: number;
    trialEnd?: Date;
  };
}

class SubscriptionService {
  
  /**
   * Get comprehensive subscription status for a user
   */
  async getUserSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
      // Get user's current token info
      const { data: userTokens } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!userTokens) {
        return {
          isActive: false,
          tier: 'free'
        };
      }

      // Get subscription info if exists
      const { data: customer } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .single();

      let subscription: SubscriptionInfo | undefined;
      if (customer) {
        const { data: subData } = await supabase
          .from('stripe_subscriptions')
          .select('*')
          .eq('customer_id', customer.customer_id)
          .single();

        subscription = subData || undefined;
      }

      // Calculate billing information
      let nextBillingDate: Date | undefined;
      let daysUntilBilling: number | undefined;
      let trialStatus: SubscriptionStatus['trialStatus'];

      if (subscription && subscription.current_period_end) {
        nextBillingDate = new Date(subscription.current_period_end * 1000);
        const now = new Date();
        daysUntilBilling = Math.ceil((nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Check trial status
        if (subscription.trial_end) {
          const trialEnd = new Date(subscription.trial_end * 1000);
          const trialDaysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          trialStatus = {
            inTrial: trialDaysRemaining > 0,
            daysRemaining: trialDaysRemaining > 0 ? trialDaysRemaining : undefined,
            trialEnd: trialEnd
          };
        }
      }

      const isActive = userTokens.tier !== 'free' && 
                      (!subscription || ['active', 'trialing'].includes(subscription.status));

      return {
        isActive,
        tier: userTokens.tier,
        subscription,
        nextBillingDate,
        daysUntilBilling,
        trialStatus
      };

    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw new Error('Failed to get subscription status');
    }
  }

  /**
   * Check if user has access to a specific feature based on their tier
   */
  async validateFeatureAccess(
    userId: string, 
    feature: keyof typeof FEATURE_TIER_MAP
  ): Promise<TierFeatureAccess> {
    try {
      const { data: userTokens } = await supabase
        .from('user_tokens')
        .select('tier')
        .eq('user_id', userId)
        .single();

      if (!userTokens) {
        return {
          hasAccess: false,
          feature,
          currentTier: 'free',
          requiredTier: FEATURE_TIER_MAP[feature],
          reason: 'User token information not found'
        };
      }

      const currentTier = userTokens.tier;
      const requiredTier = FEATURE_TIER_MAP[feature];
      const hasAccess = this.compareTiers(currentTier, requiredTier);

      return {
        hasAccess,
        feature,
        currentTier,
        requiredTier,
        reason: hasAccess ? undefined : `${feature} requires ${requiredTier} tier or higher`
      };

    } catch (error) {
      console.error('Error validating feature access:', error);
      throw new Error('Failed to validate feature access');
    }
  }

  /**
   * Get user's subscription analytics and usage patterns
   */
  async getSubscriptionAnalytics(userId: string): Promise<{
    tokenUsageThisMonth: number;
    averageDailyUsage: number;
    mostUsedFeatures: Array<{feature: string; usage: number}>;
    projectedMonthlyUsage: number;
    recommendedTier?: UserTokens['tier'];
  }> {
    try {
      // Calculate current month boundaries
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const daysInMonth = monthEnd.getDate();
      const daysPassed = now.getDate();

      // Get token usage for current month
      const { data: usage } = await supabase
        .from('token_usage')
        .select('tokens_used, action_type')
        .eq('user_id', userId)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      const tokenUsageThisMonth = usage?.reduce((sum, record) => sum + record.tokens_used, 0) || 0;
      const averageDailyUsage = tokenUsageThisMonth / daysPassed;
      const projectedMonthlyUsage = averageDailyUsage * daysInMonth;

      // Calculate most used features
      const featureUsage: Record<string, number> = {};
      usage?.forEach(record => {
        featureUsage[record.action_type] = (featureUsage[record.action_type] || 0) + record.tokens_used;
      });

      const mostUsedFeatures = Object.entries(featureUsage)
        .map(([feature, usage]) => ({ feature, usage }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 5);

      // Recommend tier based on projected usage
      let recommendedTier: UserTokens['tier'] | undefined;
      if (projectedMonthlyUsage > TIER_LIMITS.creator.tokens) {
        recommendedTier = 'pro';
      } else if (projectedMonthlyUsage > TIER_LIMITS.free.tokens) {
        recommendedTier = 'creator';
      }

      return {
        tokenUsageThisMonth,
        averageDailyUsage: Math.round(averageDailyUsage * 100) / 100,
        mostUsedFeatures,
        projectedMonthlyUsage: Math.round(projectedMonthlyUsage),
        recommendedTier
      };

    } catch (error) {
      console.error('Error getting subscription analytics:', error);
      throw new Error('Failed to get subscription analytics');
    }
  }

  /**
   * Compare tier levels (free < creator < pro)
   */
  private compareTiers(currentTier: UserTokens['tier'], requiredTier: UserTokens['tier']): boolean {
    const tierOrder = { free: 0, creator: 1, pro: 2 };
    return tierOrder[currentTier] >= tierOrder[requiredTier];
  }

  /**
   * Process upcoming billing notifications
   */
  async processUpcomingBillingNotifications(): Promise<void> {
    try {
      // Get subscriptions with billing in the next 3 days
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      const { data: upcomingBilling } = await supabase
        .from('stripe_subscriptions')
        .select(`
          customer_id,
          current_period_end,
          stripe_customers!inner(user_id)
        `)
        .eq('status', 'active')
        .lte('current_period_end', Math.floor(threeDaysFromNow.getTime() / 1000));

      if (upcomingBilling) {
        for (const sub of upcomingBilling) {
          console.log(`📅 Upcoming billing for user: ${sub.stripe_customers.user_id}`);
          // TODO: Send billing reminder notifications
        }
      }

    } catch (error) {
      console.error('Error processing billing notifications:', error);
    }
  }

  /**
   * Handle grace period for failed payments
   */
  async handlePaymentGracePeriod(userId: string, gracePeriodDays: number = 7): Promise<void> {
    try {
      console.log(`⏰ Starting ${gracePeriodDays}-day grace period for user: ${userId}`);
      
      // Reduce token allocation but don't immediately downgrade
      const { data: currentTokens } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (currentTokens && currentTokens.tier !== 'free') {
        // Reduce to 25% of normal allowance during grace period
        const gracePeriodAllowance = Math.floor(currentTokens.monthly_allowance * 0.25);
        
        await supabase
          .from('user_tokens')
          .update({
            balance: Math.min(currentTokens.balance, gracePeriodAllowance),
            monthly_allowance: gracePeriodAllowance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        console.log(`📉 Reduced to grace period allowance: ${gracePeriodAllowance} tokens`);
      }

    } catch (error) {
      console.error('Error handling payment grace period:', error);
      throw error;
    }
  }
}

// Feature to tier mapping
const FEATURE_TIER_MAP = {
  'single_feedback': 'free' as const,
  'blended_feedback': 'creator' as const,
  'chunked_feedback': 'creator' as const,
  'rewrite_suggestions': 'creator' as const,
  'writer_agent': 'creator' as const,
  'premium_mentors': 'creator' as const,
  'advanced_analytics': 'pro' as const,
  'unlimited_uploads': 'pro' as const,
  'priority_support': 'creator' as const,
  'api_access': 'pro' as const
};

// Export singleton instance
export const subscriptionService = new SubscriptionService();
export default subscriptionService;