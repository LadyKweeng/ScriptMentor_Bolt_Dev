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
   * Get user's token usage statistics
   */
  async getTokenUsageStats(userId: string): Promise<TokenUsageStats> {
    try {
      // Get all usage records for the user
      const { data: usage, error } = await supabase
        .from('token_usage')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate stats
      const totalUsed = usage?.reduce((sum, record) => sum + record.tokens_used, 0) || 0;
      
      const usageByAction = (usage || []).reduce((acc, record) => {
        acc[record.action_type] = (acc[record.action_type] || 0) + record.tokens_used;
        return acc;
      }, {} as Record<TokenUsage['action_type'], number>);

      // Calculate this month's usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const usageThisMonth = (usage || [])
        .filter(record => new Date(record.created_at) >= startOfMonth)
        .reduce((sum, record) => sum + record.tokens_used, 0);

      // Calculate average daily usage (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentUsage = (usage || []).filter(record => new Date(record.created_at) >= thirtyDaysAgo);
      const averageDaily = recentUsage.length > 0 ? 
        recentUsage.reduce((sum, record) => sum + record.tokens_used, 0) / 30 : 0;

      // Calculate days until reset (assuming monthly reset)
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      const daysUntilReset = Math.ceil((nextMonth.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return {
        totalUsed,
        usageByAction,
        usageThisMonth,
        averageDaily: Math.round(averageDaily * 100) / 100,
        daysUntilReset
      };
    } catch (error) {
      console.error('Error fetching token usage stats:', error);
      throw new Error('Failed to fetch usage statistics');
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
}

// Export singleton instance
export const tokenService = new TokenService();