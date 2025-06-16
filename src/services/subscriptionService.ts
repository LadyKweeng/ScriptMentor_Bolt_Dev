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
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ? {
        id: data.id || 'free',
        userId: userId,
        tierId: data.price_id ? 
          (data.price_id === 'price_1RalzkEOpk1Bj1eeIqTOsYNq' ? 'creator' : 
           data.price_id === 'price_1Ram1AEOpk1Bj1ee2sRTCp8b' ? 'professional' : 'free') : 'free',
        status: data.subscription_status || 'active',
        currentPeriodStart: new Date(data.current_period_start * 1000 || Date.now()),
        currentPeriodEnd: new Date(data.current_period_end * 1000 || Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: data.cancel_at_period_end || false,
        stripeSubscriptionId: data.subscription_id || '',
        stripeCustomerId: data.customer_id || ''
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
      // Get user's subscription tier
      const subscription = await this.getUserSubscription(userId);
      const tierId = subscription?.tierId || 'free';
      const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId);
      
      // Calculate token balance based on subscription tier
      const totalTokens = tier?.tokens || 50; // Default to free tier
      
      // For demo purposes, we'll simulate a random usage amount
      const usedTokens = Math.floor(Math.random() * (totalTokens / 2));
      const remainingTokens = totalTokens - usedTokens;
      
      // Calculate reset date (30 days from now or subscription end date)
      const resetDate = subscription?.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      return {
        userId,
        totalTokens,
        usedTokens,
        remainingTokens,
        resetDate,
        subscriptionTier: tier?.name || 'Free'
      };
    } catch (error) {
      console.error('Error getting token balance:', error);
      
      // Return default free tier balance
      return {
        userId,
        totalTokens: 50,
        usedTokens: 0,
        remainingTokens: 50,
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subscriptionTier: 'Free'
      };
    }
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

      // For demo purposes, we'll just return success without actually updating a database
      // In a real implementation, you would update the token balance in your database
      
      return { 
        success: true, 
        remainingTokens: tokenBalance.remainingTokens - tokensRequired 
      };
    } catch (error) {
      console.error('Error consuming tokens:', error);
      return { success: false, remainingTokens: 0 };
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
      const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId);
      if (!tier || !tier.stripePriceId) {
        throw new Error('Invalid subscription tier');
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          price_id: tier.stripePriceId,
          mode: 'subscription',
          success_url: successUrl,
          cancel_url: cancelUrl
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

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
      // This would typically call a Supabase Edge Function to create a portal session
      // For now, we'll return a mock response
      return {
        url: `https://billing.stripe.com/p/session/${Math.random().toString(36).substring(2, 15)}`
      };
    } catch (error) {
      console.error('Error creating portal session:', error);
      return null;
    }
  }
}