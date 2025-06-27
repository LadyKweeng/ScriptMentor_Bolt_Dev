import { supabase } from '../utils/supabaseClient';

export interface CheckoutSessionRequest {
  priceId: string;
  mode: 'subscription' | 'payment';
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
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

  /**
   * Create checkout session with enhanced error handling
   */
  async createEnhancedCheckoutSession(request: CheckoutSessionRequest): Promise<{
    url: string;
    sessionId: string;
  }> {
    try {
      console.log('🛒 Creating enhanced checkout session:', request);

      const response = await fetch(`${this.baseUrl}/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getSupabaseToken()}`
        },
        body: JSON.stringify({
          ...request,
          metadata: {
            ...request.metadata,
            created_via: 'script_mentor_app',
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.url || !data.sessionId) {
        throw new Error('Invalid response: missing URL or session ID');
      }

      console.log('✅ Enhanced checkout session created:', data.sessionId);
      return data;
    } catch (error) {
      console.error('❌ Failed to create enhanced checkout session:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Failed to create checkout session'
      );
    }
  }

  /**
   * Get checkout session status
   */
  async getCheckoutSessionStatus(sessionId: string): Promise<{
    status: 'open' | 'complete' | 'expired';
    paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
    customerEmail?: string;
    subscriptionId?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/checkout-session/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${await this.getSupabaseToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get session status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get checkout session status:', error);
      throw error;
    }
  }

  /**
   * Redirect to checkout with enhanced tracking
   */
  async redirectToEnhancedCheckout(
    request: CheckoutSessionRequest,
    onSuccess?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      // Add tracking parameters
      const enhancedRequest = {
        ...request,
        metadata: {
          ...request.metadata,
          user_agent: navigator.userAgent,
          referrer: document.referrer,
          page_url: window.location.href
        }
      };

      const { url } = await this.createEnhancedCheckoutSession(enhancedRequest);
      
      // Store success/error callbacks in sessionStorage if provided
      if (onSuccess || onError) {
        sessionStorage.setItem('stripe_checkout_callbacks', JSON.stringify({
          hasSuccess: !!onSuccess,
          hasError: !!onError
        }));
      }

      window.location.href = url;
    } catch (error) {
      console.error('Failed to redirect to enhanced checkout:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      } else {
        throw error;
      }
    }
  }

  /**
   * Handle post-checkout callback
   */
  async handleCheckoutCallback(sessionId: string): Promise<{
    success: boolean;
    subscription?: any;
    error?: string;
  }> {
    try {
      const status = await this.getCheckoutSessionStatus(sessionId);
      
      if (status.status === 'complete' && status.paymentStatus === 'paid') {
        // Refresh user data after successful payment
        await this.refreshUserSubscriptionData();
        
        return {
          success: true,
          subscription: status.subscriptionId ? { id: status.subscriptionId } : undefined
        };
      } else {
        return {
          success: false,
          error: 'Payment was not completed successfully'
        };
      }
    } catch (error) {
      console.error('Failed to handle checkout callback:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get customer portal URL for subscription management
   */
  async getCustomerPortalUrl(returnUrl?: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/customer-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getSupabaseToken()}`
        },
        body: JSON.stringify({
          return_url: returnUrl || window.location.origin
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create portal session: ${response.statusText}`);
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Failed to get customer portal URL:', error);
      throw error;
    }
  }

  /**
   * Redirect to customer portal
   */
  async redirectToCustomerPortal(returnUrl?: string): Promise<void> {
    try {
      const url = await this.getCustomerPortalUrl(returnUrl);
      window.location.href = url;
    } catch (error) {
      console.error('Failed to redirect to customer portal:', error);
      throw error;
    }
  }

  /**
   * Refresh user subscription data
   */
  private async refreshUserSubscriptionData(): Promise<void> {
    try {
      // Trigger a refresh of user tokens and subscription data
      const event = new CustomEvent('stripe_subscription_updated', {
        detail: { timestamp: new Date().toISOString() }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to refresh user subscription data:', error);
    }
  }

  /**
   * Get Supabase auth token for API calls
   */
  private async getSupabaseToken(): Promise<string> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token available');
      }
      return session.access_token;
    } catch (error) {
      console.error('Failed to get Supabase token:', error);
      throw new Error('Authentication required');
    }
  }

  /**
   * Validate pricing before checkout
   */
  async validatePricing(priceId: string): Promise<{
    valid: boolean;
    product?: any;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/validate-price/${priceId}`, {
        headers: {
          'Authorization': `Bearer ${await this.getSupabaseToken()}`
        }
      });

      if (!response.ok) {
        return {
          valid: false,
          error: 'Failed to validate pricing'
        };
      }

      const data = await response.json();
      return {
        valid: true,
        product: data.product
      };
    } catch (error) {
      console.error('Failed to validate pricing:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get available payment methods for a customer
   */
  async getPaymentMethods(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/payment-methods`, {
        headers: {
          'Authorization': `Bearer ${await this.getSupabaseToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get payment methods: ${response.statusText}`);
      }

      const data = await response.json();
      return data.paymentMethods || [];
    } catch (error) {
      console.error('Failed to get payment methods:', error);
      return [];
    }
  }

  /**
   * Cancel subscription with feedback
   */
  async cancelSubscription(reason?: string, feedback?: string): Promise<{
    success: boolean;
    cancellationDate?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getSupabaseToken()}`
        },
        body: JSON.stringify({
          reason,
          feedback,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || 'Failed to cancel subscription'
        };
      }

      const data = await response.json();
      
      // Refresh subscription data
      await this.refreshUserSubscriptionData();
      
      return {
        success: true,
        cancellationDate: data.cancellationDate
      };
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update subscription plan
   */
  async updateSubscriptionPlan(newPriceId: string): Promise<{
    success: boolean;
    subscription?: any;
    error?: string;
  }> {
    try {
      // Validate the new price first
      const validation = await this.validatePricing(newPriceId);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Invalid pricing plan'
        };
      }

      const response = await fetch(`${this.baseUrl}/update-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getSupabaseToken()}`
        },
        body: JSON.stringify({
          price_id: newPriceId,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || 'Failed to update subscription'
        };
      }

      const data = await response.json();
      
      // Refresh subscription data
      await this.refreshUserSubscriptionData();
      
      return {
        success: true,
        subscription: data.subscription
      };
    } catch (error) {
      console.error('Failed to update subscription plan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const stripeService = new StripeService();