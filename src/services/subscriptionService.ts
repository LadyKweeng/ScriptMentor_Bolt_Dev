// src/services/subscriptionService.ts
import { supabase } from '../utils/supabaseClient';
import { UserSubscription, UserTokenBalance, TokenUsage } from '../types/subscription';
import { SUBSCRIPTION_TIERS, calculateTokenCost } from '../data/subscriptionTiers';

export class SubscriptionService {
  /**
   * Get user's current subscription
   */
  static async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ? {
        id: data.id,
        userId: data.user_id,
        tierId: data.tier_id,
        status: data.status,
        currentPeriodStart: new Date(data.current_period_start),
        currentPeriodEnd: new Date(data.current_period_end),
        cancelAtPeriodEnd: data.cancel_at_period_end,
        stripeSubscriptionId: data.stripe_subscription_id,
        stripeCustomerId: data.stripe_customer_id
      } : null;
    } catch (error) {
      console.error('Error fetching user subscription:', error);
      return null;
    }
  }

  /**
   * Get user's token balance
   */
  static async getUserTokenBalance(userId: string): Promise<UserTokenBalance> {
    try {
      const { data, error } = await supabase
        .from('user_token_balances')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        return {
          userId: data.user_id,
          totalTokens: data.total_tokens,
          usedTokens: data.used_tokens,
          remainingTokens: data.remaining_tokens,
          resetDate: new Date(data.reset_date),
          subscriptionTier: data.subscription_tier
        };
      } else {
        // Create default free tier balance
        return await this.initializeUserTokenBalance(userId);
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
      // Return free tier default
      return {
        userId,
        totalTokens: 50,
        usedTokens: 0,
        remainingTokens: 50,
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        subscriptionTier: 'free'
      };
    }
  }

  /**
   * Initialize token balance for new user
   */
  static async initializeUserTokenBalance(userId: string): Promise<UserTokenBalance> {
    const freeTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'free')!;
    const resetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    const tokenBalance: UserTokenBalance = {
      userId,
      totalTokens: freeTier.tokens,
      usedTokens: 0,
      remainingTokens: freeTier.tokens,
      resetDate,
      subscriptionTier: 'free'
    };

    try {
      await supabase
        .from('user_token_balances')
        .insert({
          user_id: userId,
          total_tokens: tokenBalance.totalTokens,
          used_tokens: tokenBalance.usedTokens,
          remaining_tokens: tokenBalance.remainingTokens,
          reset_date: resetDate.toISOString(),
          subscription_tier: tokenBalance.subscriptionTier
        });
    } catch (error) {
      console.error('Error initializing token balance:', error);
    }

    return tokenBalance;
  }

  /**
   * Check if user has enough tokens for an action
   */
  static async checkTokenAvailability(
    userId: string, 
    action: string, 
    options: { chunkCount?: number; contentLength?: number } = {}
  ): Promise<{ hasTokens: boolean; required: number; available: number }> {
    const tokenBalance = await this.getUserTokenBalance(userId);
    const requiredTokens = calculateTokenCost(action, options);

    return {
      hasTokens: tokenBalance.remainingTokens >= requiredTokens,
      required: requiredTokens,
      available: tokenBalance.remainingTokens
    };
  }

  /**
   * Consume tokens for an action
   */
  static async consumeTokens(
    userId: string,
    action: string,
    options: {
      chunkCount?: number;
      contentLength?: number;
      scriptId?: string;
      mentorId?: string;
      details?: any;
    } = {}
  ): Promise<{ success: boolean; remainingTokens: number }> {
    const tokensRequired = calculateTokenCost(action, options);
    
    try {
      // Check current balance
      const tokenBalance = await this.getUserTokenBalance(userId);
      
      if (tokenBalance.remainingTokens < tokensRequired) {
        return { success: false, remainingTokens: tokenBalance.remainingTokens };
      }

      // Update token balance
      const newUsedTokens = tokenBalance.usedTokens + tokensRequired;
      const newRemainingTokens = tokenBalance.totalTokens - newUsedTokens;

      await supabase
        .from('user_token_balances')
        .update({
          used_tokens: newUsedTokens,
          remaining_tokens: newRemainingTokens,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      // Log token usage
      await supabase
        .from('token_usage')
        .insert({
          user_id: userId,
          action,
          tokens_used: tokensRequired,
          script_id: options.scriptId,
          mentor_id: options.mentorId,
          details: options.details
        });

      return { success: true, remainingTokens: newRemainingTokens };
    } catch (error) {
      console.error('Error consuming tokens:', error);
      return { success: false, remainingTokens: 0 };
    }
  }

  /**
   * Get user's token usage history
   */
  static async getTokenUsageHistory(userId: string, limit = 50): Promise<TokenUsage[]> {
    try {
      const { data, error } = await supabase
        .from('token_usage')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data.map(usage => ({
        id: usage.id,
        userId: usage.user_id,
        action: usage.action,
        tokensUsed: usage.tokens_used,
        timestamp: new Date(usage.created_at),
        scriptId: usage.script_id,
        mentorId: usage.mentor_id,
        details: usage.details
      }));
    } catch (error) {
      console.error('Error fetching token usage history:', error);
      return [];
    }
  }

  /**
   * Create Stripe checkout session
   */
  static async createCheckoutSession(
    userId: string,
    tierId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          userId,
          tierId,
          successUrl,
          cancelUrl
        }
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return null;
    }
  }

  /**
   * Create Stripe customer portal session
   */
  static async createPortalSession(userId: string, returnUrl: string): Promise<{ url: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
          userId,
          returnUrl
        }
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating portal session:', error);
      return null;
    }
  }
}