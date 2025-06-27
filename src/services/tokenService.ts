// src/services/tokenService.ts
import { supabase } from '../utils/supabaseClient';
import {
  UserTokens,
  TokenUsage,
  TokenTransaction,
  TOKEN_COSTS,
  TIER_LIMITS,
  PRICE_ID_TO_TIER,
  TokenDeductionRequest,
  TokenAllocationRequest,
  TokenValidationResult,
  TokenUsageStats,
  UserAnalytics,
  SubscriptionStatus,
  BatchValidationResult,
  TokenUpdateCallback,
  UnsubscribeFunction,
  isValidActionType,
  isValidTransactionType,
  getTierAllowance
} from '../types/tokens';

// Development mode detection
const isDevelopment = () => {
  return (
    import.meta.env.DEV ||
    import.meta.env.MODE === 'development' ||
    import.meta.env.VITE_DEV_MODE === 'true'
  );
};

const isUnlimitedTokensEnabled = () => {
  return import.meta.env.VITE_UNLIMITED_TOKENS === 'true';
};

const isTestUser = (userId: string) => {
  const testUserIds = [
    'demo-user-12345',
    import.meta.env.VITE_TEST_USER_ID,
    'test-user-dev'
  ].filter(Boolean);

  return testUserIds.includes(userId);
};

const shouldBypassTokens = (userId: string) => {
  const bypass = isDevelopment() && (isUnlimitedTokensEnabled() || isTestUser(userId));
  if (bypass) {
    console.log('🚀 Development mode: Bypassing tokens for user:', userId);
  }
  return bypass;
};

export class TokenService {
  /**
   * Get user's current token balance and account info
   */
  async getUserTokenBalance(userId: string): Promise<UserTokens | null> {
    try {
      const { data, error } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // User not found, initialize with free tier
          console.log('User not found in tokens table, initializing...');
          return await this.initializeUserTokens(userId);
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user token balance:', error);
      throw new Error('Failed to fetch token balance');
    }
  }

  /**
   * Initialize new user with free tier tokens
   */
  private async initializeUserTokens(userId: string): Promise<UserTokens> {
    try {
      const { error } = await supabase.rpc('reset_monthly_tokens', {
        p_user_id: userId,
        p_tier: 'free',
        p_allowance: 50
      });

      if (error) throw error;

      // Fetch the newly created user tokens
      const newUser = await this.getUserTokenBalance(userId);
      if (!newUser) {
        throw new Error('Failed to initialize user tokens');
      }

      return newUser;
    } catch (error) {
      console.error('Error initializing user tokens:', error);
      throw new Error('Failed to initialize user tokens');
    }
  }

  /**
   * Validate if user has enough tokens for an action
   */
  async validateTokenBalance(userId: string, requiredTokens: number): Promise<TokenValidationResult> {
    // Development bypass
    if (shouldBypassTokens(userId)) {
      return {
        hasEnoughTokens: true,
        currentBalance: 999999, // Mock unlimited balance
        requiredTokens,
        tier: 'pro' // Grant pro tier access
      };
    }

    try {
      const userTokens = await this.getUserTokenBalance(userId);

      if (!userTokens) {
        throw new Error('User token information not found');
      }

      const hasEnoughTokens = userTokens.balance >= requiredTokens;
      const shortfall = hasEnoughTokens ? undefined : requiredTokens - userTokens.balance;

      return {
        hasEnoughTokens,
        currentBalance: userTokens.balance,
        requiredTokens,
        shortfall,
        tier: userTokens.tier
      };
    } catch (error) {
      console.error('Error validating token balance:', error);
      throw new Error('Failed to validate token balance');
    }
  }

  /**
   * Deduct tokens from user account with transaction logging
   */
  async deductTokens(request: TokenDeductionRequest): Promise<boolean> {
    const { userId, tokensToDeduct, actionType, scriptId, mentorId, sceneId } = request;

    if (shouldBypassTokens(userId)) {
      console.log(`🚀 Development bypass: Skipping deduction of ${tokensToDeduct} tokens for ${actionType}`);
      return true;
    }

    try {
      // Validate action type
      if (!isValidActionType(actionType)) {
        throw new Error(`Invalid action type: ${actionType}`);
      }

      // Use the database function for atomic deduction
      const { data, error } = await supabase.rpc('deduct_user_tokens', {
        p_user_id: userId,
        p_tokens_to_deduct: tokensToDeduct,
        p_action_type: actionType,
        p_script_id: scriptId || null,
        p_mentor_id: mentorId || null,
        p_scene_id: sceneId || null
      });

      if (error) {
        console.error('Database error during token deduction:', error);
        return false;
      }

      // The function returns boolean indicating success
      if (data === true) {
        console.log(`✅ Successfully deducted ${tokensToDeduct} tokens for ${actionType}`, {
          userId,
          scriptId,
          mentorId,
          sceneId
        });
        return true;
      } else {
        console.warn(`❌ Token deduction failed - insufficient balance`, {
          userId,
          requiredTokens: tokensToDeduct,
          actionType
        });
        return false;
      }
    } catch (error) {
      console.error('Error deducting tokens:', error);
      return false;
    }
  }

  /**
   * Add tokens to user account (for admin/bonus purposes)
   */
  async addTokens(request: TokenAllocationRequest): Promise<boolean> {
    const {
      userId,
      tokensToAdd,
      transactionType,
      stripePaymentId,
      stripeSubscriptionId,
      description
    } = request;

    try {
      // Validate transaction type
      if (!isValidTransactionType(transactionType)) {
        throw new Error(`Invalid transaction type: ${transactionType}`);
      }

      // Insert transaction record directly (since add_user_tokens might not exist yet)
      const { error: transactionError } = await supabase
        .from('token_transactions')
        .insert({
          user_id: userId,
          tokens_added: tokensToAdd,
          transaction_type: transactionType,
          stripe_payment_id: stripePaymentId || null,
          stripe_subscription_id: stripeSubscriptionId || null,
          description: description || null
        });

      if (transactionError) {
        console.error('Error inserting transaction:', transactionError);
        return false;
      }

      // Update user balance
      const { error: updateError } = await supabase
        .from('user_tokens')
        .update({
          balance: supabase.sql`balance + ${tokensToAdd}`,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating user balance:', updateError);
        return false;
      }

      console.log(`✅ Successfully added ${tokensToAdd} tokens via ${transactionType}`, {
        userId,
        description
      });
      return true;
    } catch (error) {
      console.error('Error adding tokens:', error);
      return false;
    }
  }

  /**
   * Get token cost for a specific action
   */
  getTokenCost(actionType: TokenUsage['action_type']): number {
    if (!isValidActionType(actionType)) {
      throw new Error(`Invalid action type: ${actionType}`);
    }
    return TOKEN_COSTS[actionType];
  }

  /**
   * ENHANCED: Get detailed usage statistics for a user
   */
  async getUserUsageStats(userId: string): Promise<TokenUsageStats> {
    try {
      // Get current user tokens for baseline
      const userTokens = await this.getUserTokenBalance(userId);
      if (!userTokens) {
        throw new Error('User token data not found');
      }

      // Calculate days since last reset
      const lastReset = new Date(userTokens.last_reset_date);
      const now = new Date();
      const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysUntilReset = Math.max(0, daysInMonth - daysSinceReset);

      // Fetch usage data for current month (from last reset)
      const monthStart = new Date(lastReset);
      const { data: usageData, error } = await supabase
        .from('token_usage')
        .select('action_type, tokens_used, created_at')
        .eq('user_id', userId)
        .gte('created_at', monthStart.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch detailed usage stats:', error);
        // Return basic stats from user tokens
        const usageThisMonth = userTokens.monthly_allowance - userTokens.balance;
        return {
          totalUsed: usageThisMonth,
          usageByAction: {} as Record<TokenUsage['action_type'], number>,
          usageThisMonth,
          averageDaily: daysSinceReset > 0 ? usageThisMonth / daysSinceReset : 0,
          daysUntilReset
        };
      }

      // Process usage data
      const totalUsed = usageData.reduce((sum, record) => sum + record.tokens_used, 0);
      const usageByAction = usageData.reduce((acc, record) => {
        const actionType = record.action_type as TokenUsage['action_type'];
        acc[actionType] = (acc[actionType] || 0) + record.tokens_used;
        return acc;
      }, {} as Record<TokenUsage['action_type'], number>);

      const averageDaily = daysSinceReset > 0 ? totalUsed / daysSinceReset : 0;

      return {
        totalUsed,
        usageByAction,
        usageThisMonth: totalUsed,
        averageDaily,
        daysUntilReset
      };

    } catch (error) {
      console.error('Error fetching usage statistics:', error);
      throw new Error('Failed to fetch usage statistics');
    }
  }

  /**
   * NEW: Get comprehensive analytics for dashboard
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    try {
      const userTokens = await this.getUserTokenBalance(userId);
      if (!userTokens) {
        throw new Error('User token data not found');
      }

      const stats = await this.getUserUsageStats(userId);

      // Current month data
      const used = stats.usageThisMonth;
      const remaining = userTokens.balance;
      const percentage = Math.round((used / userTokens.monthly_allowance) * 100);

      // Fetch recent usage (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: recentData } = await supabase
        .from('token_usage')
        .select('action_type, tokens_used, created_at')
        .eq('user_id', userId)
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      const recentUsage = (recentData || []).map(record => ({
        date: record.created_at,
        tokensUsed: record.tokens_used,
        actionType: record.action_type as TokenUsage['action_type']
      }));

      // Project end-of-month usage
      const dailyAverage = stats.averageDaily;
      const projectedTotal = used + (dailyAverage * stats.daysUntilReset);
      const willExceedLimit = projectedTotal > userTokens.monthly_allowance;

      // Recommend tier upgrade if projected to exceed
      let recommendedTier: UserTokens['tier'] | undefined;
      if (willExceedLimit) {
        if (userTokens.tier === 'free' && projectedTotal <= 500) {
          recommendedTier = 'creator';
        } else if (userTokens.tier === 'creator' && projectedTotal <= 1500) {
          recommendedTier = 'pro';
        }
      }

      // Calculate efficiency metrics
      const actionCounts = Object.entries(stats.usageByAction).map(([action, tokens]) => ({
        action: action as TokenUsage['action_type'],
        tokens,
        count: Math.ceil(tokens / TOKEN_COSTS[action as TokenUsage['action_type']])
      }));

      const tokensPerAction = actionCounts.reduce((acc, { action, tokens, count }) => {
        acc[action] = count > 0 ? tokens / count : 0;
        return acc;
      }, {} as Record<TokenUsage['action_type'], number>);

      const mostUsedAction = actionCounts.sort((a, b) => b.tokens - a.tokens)[0]?.action || 'single_feedback';

      // Generate recommendations
      const recommendations: string[] = [];
      if (willExceedLimit && recommendedTier) {
        recommendations.push(`Consider upgrading to ${recommendedTier} tier for more tokens`);
      }
      if (dailyAverage > userTokens.monthly_allowance / 30) {
        recommendations.push('Your usage is above average - consider optimizing feedback requests');
      }
      if (stats.usageByAction.blended_feedback > stats.usageByAction.single_feedback) {
        recommendations.push('You use blended feedback frequently - great for comprehensive insights!');
      }

      return {
        currentMonth: {
          used,
          remaining,
          percentage,
          tier: userTokens.tier
        },
        recentUsage,
        projectedUsage: {
          endOfMonth: Math.round(projectedTotal),
          willExceedLimit,
          recommendedTier
        },
        efficiency: {
          tokensPerAction,
          mostUsedAction,
          recommendations
        }
      };

    } catch (error) {
      console.error('Error fetching user analytics:', error);
      throw new Error('Failed to fetch analytics data');
    }
  }

  /**
   * Log token usage (called internally by deductTokens)
   */
  async logTokenUsage(
    userId: string,
    tokensUsed: number,
    actionType: TokenUsage['action_type'],
    scriptId?: string,
    mentorId?: string,
    sceneId?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('token_usage')
        .insert({
          user_id: userId,
          tokens_used: tokensUsed,
          action_type: actionType,
          script_id: scriptId || null,
          mentor_id: mentorId || null,
          scene_id: sceneId || null
        });

      if (error) throw error;

      console.log(`📊 Logged token usage: ${tokensUsed} tokens for ${actionType}`);
    } catch (error) {
      console.error('Error logging token usage:', error);
      // Don't throw here as this is secondary to the main action
    }
  }

  /**
   * Check if user has sufficient tokens for an action and return validation
   */
  async validateAndPrepareDeduction(
    userId: string,
    actionType: TokenUsage['action_type'],
    scriptId?: string,
    mentorId?: string,
    sceneId?: string
  ): Promise<{ canProceed: boolean; validation: TokenValidationResult; cost: number }> {
    try {
      const cost = this.getTokenCost(actionType);
      const validation = await this.validateTokenBalance(userId, cost);

      return {
        canProceed: validation.hasEnoughTokens,
        validation,
        cost
      };
    } catch (error) {
      console.error('Error in validateAndPrepareDeduction:', error);
      throw error;
    }
  }

  /**
   * Complete token transaction (validate + deduct)
   */
  async processTokenTransaction(
    userId: string,
    actionType: TokenUsage['action_type'],
    scriptId?: string,
    mentorId?: string,
    sceneId?: string
  ): Promise<{ success: boolean; validation: TokenValidationResult }> {
    if (shouldBypassTokens(userId)) {
      console.log(`🚀 Development bypass: Skipping token transaction for ${actionType}`);
      return {
        success: true,
        validation: {
          hasEnoughTokens: true,
          currentBalance: 999999,
          requiredTokens: this.getTokenCost(actionType),
          tier: 'pro'
        }
      };
    }

    try {
      const { canProceed, validation, cost } = await this.validateAndPrepareDeduction(
        userId, actionType, scriptId, mentorId, sceneId
      );

      if (!canProceed) {
        return { success: false, validation };
      }

      const deductionSuccess = await this.deductTokens({
        userId,
        tokensToDeduct: cost,
        actionType,
        scriptId,
        mentorId,
        sceneId
      });

      return {
        success: deductionSuccess,
        validation: deductionSuccess ?
          { ...validation, currentBalance: validation.currentBalance - cost } :
          validation
      };
    } catch (error) {
      console.error('Error processing token transaction:', error);
      throw error;
    }
  }

  /**
   * NEW: Reset monthly tokens for a user based on their current subscription
   */
  async resetMonthlyTokens(userId: string): Promise<boolean> {
    if (shouldBypassTokens(userId)) {
      console.log(`🚀 Development bypass: Skipping monthly reset for user ${userId}`);
      return true;
    }

    try {
      console.log(`🔄 Resetting monthly tokens for user: ${userId}`);

      // Get current user token info
      const currentTokens = await this.getUserTokenBalance(userId);
      if (!currentTokens) {
        throw new Error('User token information not found');
      }

      // Get subscription info to determine current tier
      const { data: customer } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .single();

      let targetTier: UserTokens['tier'] = 'free';
      let targetAllowance = 50;

      if (customer) {
        const { data: subscription } = await supabase
          .from('stripe_subscriptions')
          .select('price_id, status')
          .eq('customer_id', customer.customer_id)
          .single();

        if (subscription && ['active', 'trialing'].includes(subscription.status)) {
          const tierConfig = PRICE_ID_TO_TIER[subscription.price_id];
          if (tierConfig) {
            targetTier = tierConfig;
            targetAllowance = getTierAllowance(tierConfig);
          }
        }
      }

      // Use the database function to reset tokens
      const { error } = await supabase.rpc('reset_monthly_tokens', {
        p_user_id: userId,
        p_tier: targetTier,
        p_allowance: targetAllowance
      });

      if (error) {
        console.error('Error resetting monthly tokens:', error);
        return false;
      }

      // Log the reset transaction
      const { error: transactionError } = await supabase
        .from('token_transactions')
        .insert({
          user_id: userId,
          tokens_added: targetAllowance,
          transaction_type: 'monthly_reset',
          description: `Monthly reset: ${targetAllowance} tokens (${targetTier} tier)`
        });

      if (transactionError) {
        console.error('Error logging reset transaction:', transactionError);
        // Don't throw here, the main reset succeeded
      }

      console.log(`✅ Monthly reset completed: ${targetAllowance} tokens (${targetTier} tier)`);
      return true;

    } catch (error) {
      console.error('Error in monthly token reset:', error);
      return false;
    }
  }

  /**
   * NEW: Process monthly resets for all eligible users
   */
  async processAllMonthlyResets(): Promise<{ success: number; failed: number }> {
    try {
      console.log('🔄 Processing monthly resets for all users...');

      // Get all users whose reset date is more than 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: usersToReset } = await supabase
        .from('user_tokens')
        .select('user_id, last_reset_date')
        .lt('last_reset_date', thirtyDaysAgo.toISOString());

      if (!usersToReset || usersToReset.length === 0) {
        console.log('📊 No users need monthly reset');
        return { success: 0, failed: 0 };
      }

      console.log(`📊 Processing resets for ${usersToReset.length} users`);

      let successCount = 0;
      let failedCount = 0;

      // Process resets in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < usersToReset.length; i += batchSize) {
        const batch = usersToReset.slice(i, i + batchSize);

        const resetPromises = batch.map(async (user) => {
          try {
            const success = await this.resetMonthlyTokens(user.user_id);
            if (success) {
              successCount++;
            } else {
              failedCount++;
            }
          } catch (error) {
            console.error(`Failed to reset tokens for user ${user.user_id}:`, error);
            failedCount++;
          }
        });

        await Promise.all(resetPromises);

        // Small delay between batches
        if (i + batchSize < usersToReset.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Monthly reset completed: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount };

    } catch (error) {
      console.error('Error processing monthly resets:', error);
      throw error;
    }
  }

  /**
   * NEW: Check if user needs a monthly reset
   */
  async checkNeedsMonthlyReset(userId: string): Promise<boolean> {
    try {
      const userTokens = await this.getUserTokenBalance(userId);
      if (!userTokens) return false;

      const lastReset = new Date(userTokens.last_reset_date);
      const now = new Date();

      // Check if more than 30 days have passed
      const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));

      return daysSinceReset >= 30;

    } catch (error) {
      console.error('Error checking monthly reset status:', error);
      return false;
    }
  }

  /**
   * NEW: Force manual reset for a specific user (admin function)
   */
  async forceMonthlyReset(userId: string, reason?: string): Promise<boolean> {
    try {
      console.log(`🔧 Admin force reset for user: ${userId}, reason: ${reason || 'Manual admin reset'}`);

      const success = await this.resetMonthlyTokens(userId);

      if (success && reason) {
        // Log admin action
        const { error: logError } = await supabase
          .from('token_transactions')
          .insert({
            user_id: userId,
            tokens_added: 0,
            transaction_type: 'admin_adjustment',
            description: `Admin force reset: ${reason}`
          });

        if (logError) {
          console.error('Error logging admin action:', logError);
        }
      }

      return success;

    } catch (error) {
      console.error('Error in force monthly reset:', error);
      return false;
    }
  }

  /**
   * NEW: Check subscription status and tier permissions
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
      const userTokens = await this.getUserTokenBalance(userId);
      if (!userTokens) {
        throw new Error('User subscription data not found');
      }

      // Check for active Stripe subscription
      const { data: subscription } = await supabase
        .from('stripe_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      const hasActiveSubscription = userTokens.tier !== 'free' && !!subscription;

      // Define tier features
      const tierFeatures = {
        free: {
          blendedFeedback: false,
          writerAgent: false,
          chunkedFeedback: false,
          premiumMentors: false,
          prioritySupport: false
        },
        creator: {
          blendedFeedback: true,
          writerAgent: true,
          chunkedFeedback: true,
          premiumMentors: true,
          prioritySupport: false
        },
        pro: {
          blendedFeedback: true,
          writerAgent: true,
          chunkedFeedback: true,
          premiumMentors: true,
          prioritySupport: true
        }
      };

      return {
        hasActiveSubscription,
        tier: userTokens.tier,
        billingCycle: subscription?.billing_cycle || 'monthly',
        nextBillingDate: subscription?.current_period_end,
        canceledAt: subscription?.canceled_at,
        features: tierFeatures[userTokens.tier]
      };

    } catch (error) {
      console.error('Error fetching subscription status:', error);
      throw new Error('Failed to fetch subscription status');
    }
  }

  /**
   * NEW: Real-time token balance with WebSocket-like updates
   */
  async subscribeToTokenUpdates(
    userId: string,
    callback: TokenUpdateCallback
  ): Promise<UnsubscribeFunction> {
    try {
      // Setup real-time subscription using Supabase real-time
      const subscription = supabase
        .channel(`token_updates_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_tokens',
            filter: `user_id=eq.${userId}`
          },
          async (payload) => {
            console.log('Token balance updated:', payload);
            // Fetch fresh data and notify callback
            try {
              const updatedTokens = await this.getUserTokenBalance(userId);
              if (updatedTokens) {
                callback(updatedTokens);
              }
            } catch (error) {
              console.error('Error fetching updated tokens:', error);
            }
          }
        )
        .subscribe();

      // Return unsubscribe function
      return () => {
        supabase.removeChannel(subscription);
      };

    } catch (error) {
      console.error('Error setting up token subscription:', error);
      // Return no-op unsubscribe function
      return () => {};
    }
  }

  /**
   * NEW: Batch token validation for multiple actions
   */
  async validateMultipleActions(
    userId: string,
    actions: Array<{
      actionType: TokenUsage['action_type'];
      quantity?: number;
    }>
  ): Promise<BatchValidationResult> {
    try {
      const userTokens = await this.getUserTokenBalance(userId);
      if (!userTokens) {
        throw new Error('User token data not found');
      }

      let totalCost = 0;
      const insufficientActions: Array<{
        actionType: TokenUsage['action_type'];
        required: number;
        shortfall: number;
      }> = [];

      // Calculate total cost and check each action
      for (const action of actions) {
        const cost = TOKEN_COSTS[action.actionType] * (action.quantity || 1);
        totalCost += cost;

        if (userTokens.balance < cost) {
          insufficientActions.push({
            actionType: action.actionType,
            required: cost,
            shortfall: cost - userTokens.balance
          });
        }
      }

      const canAffordAll = userTokens.balance >= totalCost && insufficientActions.length === 0;

      return {
        canAffordAll,
        totalCost,
        currentBalance: userTokens.balance,
        insufficientActions
      };

    } catch (error) {
      console.error('Error validating multiple actions:', error);
      throw new Error('Failed to validate multiple actions');
    }
  }
}

// Export singleton instance
export const tokenService = new TokenService();