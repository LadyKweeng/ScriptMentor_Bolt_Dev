// src/services/tokenService.ts
import { supabase } from '../utils/supabaseClient';
import { 
  UserTokens, 
  TokenUsage, 
  TokenTransaction, 
  TOKEN_COSTS, 
  TokenDeductionRequest, 
  TokenAllocationRequest,
  TokenValidationResult,
  TokenUsageStats,
  isValidActionType,
  isValidTransactionType
} from '../types/tokens';

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
      const { data, error } = await supabase.rpc('reset_monthly_tokens', {
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

      const { data, error } = await supabase.rpc('add_user_tokens', {
        p_user_id: userId,
        p_tokens_to_add: tokensToAdd,
        p_transaction_type: transactionType,
        p_stripe_payment_id: stripePaymentId || null,
        p_stripe_subscription_id: stripeSubscriptionId || null,
        p_description: description || null
      });

      if (error) {
        console.error('Database error during token addition:', error);
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
      const totalUsed = usage.reduce((sum, record) => sum + record.tokens_used, 0);
      
      const usageByAction = usage.reduce((acc, record) => {
        acc[record.action_type] = (acc[record.action_type] || 0) + record.tokens_used;
        return acc;
      }, {} as Record<TokenUsage['action_type'], number>);

      // Calculate this month's usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const usageThisMonth = usage
        .filter(record => new Date(record.created_at) >= startOfMonth)
        .reduce((sum, record) => sum + record.tokens_used, 0);

      // Calculate average daily usage (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentUsage = usage.filter(record => new Date(record.created_at) >= thirtyDaysAgo);
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
}

// Export singleton instance
export const tokenService = new TokenService();