import { supabase } from '../utils/supabaseClient';

export interface CheckoutSessionRequest {
  priceId: string;
  mode: 'subscription' | 'payment';
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface UserSubscription {
  customer_id: string;
  subscription_id: string | null;
  subscription_status: string;
  price_id: string | null;
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
}

class StripeService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  }

  /**
   * Create a Stripe checkout session
   */
  async createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('User not authenticated');
      }

      const defaultUrls = {
        successUrl: `${window.location.origin}/success`,
        cancelUrl: `${window.location.origin}/pricing`
      };

      const response = await fetch(`${this.baseUrl}/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          price_id: request.priceId,
          mode: request.mode,
          success_url: request.successUrl || defaultUrls.successUrl,
          cancel_url: request.cancelUrl || defaultUrls.cancelUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      throw error;
    }
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(): Promise<UserSubscription | null> {
    try {
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch user subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to get user subscription:', error);
      return null;
    }
  }

  /**
   * Check if user has an active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription();
      return subscription?.subscription_status === 'active' || false;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
    }
  }

  /**
   * Get user's subscription plan name
   */
  async getSubscriptionPlanName(): Promise<string> {
    try {
      const subscription = await this.getUserSubscription();
      
      if (!subscription?.price_id) {
        return 'Free Tier';
      }

      // Map price IDs to plan names
      const priceIdToName: Record<string, string> = {
        'price_1Raly0EOpk1Bj1eeuMuWMJ7Y': 'Free Tier',
        'price_1RalzkEOpk1Bj1eeIqTOsYNq': 'Creator',
        'price_1Ram1AEOpk1Bj1ee2sRTCp8b': 'Pro'
      };

      return priceIdToName[subscription.price_id] || 'Unknown Plan';
    } catch (error) {
      console.error('Failed to get subscription plan name:', error);
      return 'Free Tier';
    }
  }

  /**
   * Redirect to Stripe checkout
   */
  async redirectToCheckout(request: CheckoutSessionRequest): Promise<void> {
    try {
      const { url } = await this.createCheckoutSession(request);
      window.location.href = url;
    } catch (error) {
      console.error('Failed to redirect to checkout:', error);
      throw error;
    }
  }
}

export const stripeService = new StripeService();