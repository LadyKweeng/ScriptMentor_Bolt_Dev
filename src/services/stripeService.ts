// src/services/stripeService.ts
import { supabase } from '../utils/supabaseClient';
import { STRIPE_PRODUCTS, StripeProduct } from '../stripe-config';

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface UserSubscription {
  customerId: string;
  subscriptionId: string | null;
  status: string;
  priceId: string | null;
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
}

export class StripeService {
  /**
   * Create a Stripe checkout session
   */
  static async createCheckoutSession(
    priceId: string,
    mode: 'subscription' | 'payment' = 'subscription',
    successUrl?: string,
    cancelUrl?: string
  ): Promise<CheckoutSessionResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('User not authenticated');
    }

    const defaultSuccessUrl = `${window.location.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${window.location.origin}/pricing`;

    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        price_id: priceId,
        mode,
        success_url: successUrl || defaultSuccessUrl,
        cancel_url: cancelUrl || defaultCancelUrl
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      console.error('Stripe checkout error:', error);
      throw new Error(error.message || 'Failed to create checkout session');
    }

    if (!data?.sessionId || !data?.url) {
      throw new Error('Invalid response from checkout service');
    }

    return data;
  }

  /**
   * Get user's current subscription
   */
  static async getUserSubscription(): Promise<UserSubscription | null> {
    try {
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      return {
        customerId: data.customer_id,
        subscriptionId: data.subscription_id,
        status: data.subscription_status,
        priceId: data.price_id,
        currentPeriodStart: data.current_period_start,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        paymentMethodBrand: data.payment_method_brand,
        paymentMethodLast4: data.payment_method_last4
      };
    } catch (error) {
      console.error('Error in getUserSubscription:', error);
      return null;
    }
  }

  /**
   * Get user's subscription tier based on their current subscription
   */
  static async getUserSubscriptionTier(): Promise<StripeProduct | null> {
    const subscription = await this.getUserSubscription();
    
    if (!subscription?.priceId) {
      // Return free tier if no subscription
      return STRIPE_PRODUCTS.find(p => p.price === 0) || null;
    }

    return STRIPE_PRODUCTS.find(p => p.priceId === subscription.priceId) || null;
  }

  /**
   * Check if user has an active subscription
   */
  static async hasActiveSubscription(): Promise<boolean> {
    const subscription = await this.getUserSubscription();
    return subscription?.status === 'active' || subscription?.status === 'trialing';
  }

  /**
   * Get all available products
   */
  static getProducts(): StripeProduct[] {
    return STRIPE_PRODUCTS;
  }

  /**
   * Get product by price ID
   */
  static getProductByPriceId(priceId: string): StripeProduct | undefined {
    return STRIPE_PRODUCTS.find(product => product.priceId === priceId);
  }

  /**
   * Format subscription status for display
   */
  static formatSubscriptionStatus(status: string): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'trialing':
        return 'Trial';
      case 'past_due':
        return 'Past Due';
      case 'canceled':
        return 'Canceled';
      case 'incomplete':
        return 'Incomplete';
      case 'incomplete_expired':
        return 'Expired';
      case 'unpaid':
        return 'Unpaid';
      case 'paused':
        return 'Paused';
      default:
        return 'Unknown';
    }
  }

  /**
   * Format date for display
   */
  static formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}