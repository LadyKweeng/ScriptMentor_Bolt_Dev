// src/services/stripeService.ts
import { supabase } from '../utils/supabaseClient';

export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  subscriptionId?: string;
  status?: string;
  currentPeriodEnd?: number;
}

class StripeService {
  private baseUrl = import.meta.env.VITE_SUPABASE_URL;

  async hasActiveSubscription(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('subscription_status')
        .single();

      if (error) {
        console.log('No subscription found:', error);
        return false;
      }

      return data?.subscription_status === 'active';
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  }

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { hasActiveSubscription: false };
      }

      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .single();

      if (error || !data) {
        return { hasActiveSubscription: false };
      }

      return {
        hasActiveSubscription: data.subscription_status === 'active',
        subscriptionId: data.subscription_id,
        status: data.subscription_status,
        currentPeriodEnd: data.current_period_end
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return { hasActiveSubscription: false };
    }
  }

  async createCheckoutSession(priceId: string): Promise<{ url: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { priceId }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }
}

export const stripeService = new StripeService();