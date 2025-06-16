// src/components/SubscriptionManager.tsx
import React, { useState, useEffect } from 'react';
import { Check, Zap, Crown, Star, ArrowRight, Loader, X } from 'lucide-react';
import { StripeService } from '../services/stripeService';
import TokenBalance from './TokenBalance';

interface SubscriptionManagerProps {
  onUpgrade?: () => void;
  userId?: string;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ 
  onUpgrade,
  userId 
}) => {
  const [subscription, setSubscription] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadSubscriptionData();
    }
  }, [userId]);

  const loadSubscriptionData = async () => {
    try {
      setIsLoading(true);
      const subscriptionData = await StripeService.getUserSubscription();
      setSubscription(subscriptionData);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    // This would typically open the Stripe Customer Portal
    alert('This would open the Stripe Customer Portal in a real implementation');
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400"></div>
          <span className="ml-3 text-slate-400">Loading subscription...</span>
        </div>
      </div>
    );
  }

  const isFree = !subscription || subscription.status === 'not_started';

  return (
    <div className="space-y-6">
      {/* Token Balance */}
      {userId && (
        <TokenBalance 
          userId={userId} 
          onUpgrade={onUpgrade}
        />
      )}

      {/* Subscription Details */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-400" />
            <h3 className="font-medium text-white">Subscription Details</h3>
          </div>
          
          {!isFree && (
            <button
              onClick={handleManageSubscription}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-md transition-colors"
            >
              <Zap className="h-4 w-4" />
              Manage Subscription
            </button>
          )}
        </div>

        {/* Current Plan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-slate-400 mb-2">Current Plan</h4>
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500/20 p-2 rounded-lg">
                <Crown className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="font-medium text-white">
                  {subscription?.status === 'active' ? 
                    (subscription.priceId === 'price_1RalzkEOpk1Bj1eeIqTOsYNq' ? 'Creator' : 
                     subscription.priceId === 'price_1Ram1AEOpk1Bj1ee2sRTCp8b' ? 'Pro' : 'Free') : 
                    'Free'}
                </p>
                <p className="text-sm text-slate-400">
                  {subscription?.status === 'active' ? 
                    (subscription.priceId === 'price_1RalzkEOpk1Bj1eeIqTOsYNq' ? '500 tokens per month' : 
                     subscription.priceId === 'price_1Ram1AEOpk1Bj1ee2sRTCp8b' ? '1,500 tokens per month' : 
                     '50 tokens per month') : 
                    '50 tokens per month'}
                </p>
              </div>
            </div>
          </div>

          {subscription && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Status</h4>
              <div className="flex items-center gap-2">
                <div className={subscription.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                  {subscription.status === 'active' ? 
                    <Check className="h-4 w-4" /> : 
                    <Zap className="h-4 w-4" />}
                </div>
                <span className={`font-medium capitalize ${subscription.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {subscription.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Free Plan CTA */}
        {isFree && onUpgrade && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="bg-gradient-to-r from-yellow-500/10 to-purple-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-white mb-1">Unlock More AI Power</h4>
                  <p className="text-sm text-slate-400">
                    Upgrade to get more tokens and advanced features
                  </p>
                </div>
                <button
                  onClick={onUpgrade}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-medium rounded-md transition-colors"
                >
                  <TrendingUp className="h-4 w-4" />
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Plan Features */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="font-medium text-white mb-4">Plan Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {subscription?.status === 'active' ? (
            subscription.priceId === 'price_1RalzkEOpk1Bj1eeIqTOsYNq' ? (
              // Creator plan features
              <>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">500 AI feedback tokens per month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Chunked script analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">All mentor personalities</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Blended mentor feedback</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Writer suggestions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Priority support</span>
                </div>
              </>
            ) : subscription.priceId === 'price_1Ram1AEOpk1Bj1ee2sRTCp8b' ? (
              // Pro plan features
              <>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">1,500 AI feedback tokens per month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Everything from Creator tier</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">30% token discount</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Unlimited script storage</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Advanced analytics</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Dedicated support</span>
                </div>
              </>
            ) : (
              // Free plan features (fallback)
              <>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">50 AI feedback tokens per month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Single scene analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Basic mentor feedback</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Script library storage</span>
                </div>
              </>
            )
          ) : (
            // Free plan features
            <>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-slate-300">50 AI feedback tokens per month</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-slate-300">Single scene analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-slate-300">Basic mentor feedback</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-slate-300">Script library storage</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManager;