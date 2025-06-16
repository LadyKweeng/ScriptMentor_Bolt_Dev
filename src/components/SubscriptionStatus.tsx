// src/components/SubscriptionStatus.tsx
import React, { useState, useEffect } from 'react';
import { Crown, Zap, Calendar, CreditCard, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { StripeService, UserSubscription } from '../services/stripeService';
import { StripeProduct } from '../stripe-config';

interface SubscriptionStatusProps {
  onUpgrade?: () => void;
  compact?: boolean;
}

const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({ onUpgrade, compact = false }) => {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [currentTier, setCurrentTier] = useState<StripeProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [subscriptionData, tierData] = await Promise.all([
        StripeService.getUserSubscription(),
        StripeService.getUserSubscriptionTier()
      ]);
      
      setSubscription(subscriptionData);
      setCurrentTier(tierData);
    } catch (err) {
      console.error('Error loading subscription data:', err);
      setError('Failed to load subscription information');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'trialing': return 'text-blue-400';
      case 'past_due': return 'text-yellow-400';
      case 'canceled': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'trialing': return <Calendar className="h-4 w-4" />;
      case 'past_due': return <AlertTriangle className="h-4 w-4" />;
      case 'canceled': return <AlertTriangle className="h-4 w-4" />;
      default: return <Crown className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className={`${compact ? 'p-3' : 'p-4'} bg-slate-800 rounded-lg border border-slate-700`}>
        <div className="flex items-center gap-2">
          <Loader className="h-4 w-4 animate-spin text-yellow-400" />
          <span className="text-slate-400 text-sm">Loading subscription...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${compact ? 'p-3' : 'p-4'} bg-slate-800 rounded-lg border border-slate-700`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  const isFree = !subscription || subscription.status === 'not_started' || currentTier?.price === 0;
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-medium text-white">
            {currentTier?.name || 'Free'}
          </span>
        </div>
        
        {subscription && !isFree && (
          <div className="flex items-center gap-1">
            <div className={getStatusColor(subscription.status)}>
              {getStatusIcon(subscription.status)}
            </div>
            <span className={`text-xs ${getStatusColor(subscription.status)}`}>
              {StripeService.formatSubscriptionStatus(subscription.status)}
            </span>
          </div>
        )}
        
        {isFree && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded transition-colors"
          >
            Upgrade
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-400" />
          <h3 className="font-medium text-white">Current Plan</h3>
        </div>
        
        {isFree && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded transition-colors"
          >
            <Zap className="h-3 w-3" />
            Upgrade
          </button>
        )}
      </div>

      {/* Plan Details */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-yellow-500/20 p-2 rounded-lg">
              <Crown className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="font-medium text-white">{currentTier?.name || 'Free'}</p>
              <p className="text-sm text-slate-400">{currentTier?.description}</p>
            </div>
          </div>
          
          {currentTier?.price && currentTier.price > 0 && (
            <p className="text-lg font-semibold text-white">
              ${(currentTier.price / 100).toFixed(2)}/{currentTier.interval}
            </p>
          )}
        </div>

        {/* Subscription Status */}
        {subscription && !isFree && (
          <div className="pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">Status</span>
              <div className="flex items-center gap-2">
                <div className={getStatusColor(subscription.status)}>
                  {getStatusIcon(subscription.status)}
                </div>
                <span className={`text-sm font-medium ${getStatusColor(subscription.status)}`}>
                  {StripeService.formatSubscriptionStatus(subscription.status)}
                </span>
              </div>
            </div>

            {subscription.currentPeriodEnd && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">
                  {subscription.cancelAtPeriodEnd ? 'Cancels on' : 'Renews on'}
                </span>
                <span className="text-sm text-white">
                  {StripeService.formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>
            )}

            {subscription.paymentMethodLast4 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Payment Method</span>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-white">
                    {subscription.paymentMethodBrand?.toUpperCase()} ****{subscription.paymentMethodLast4}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Free Plan Features */}
        {isFree && currentTier?.features && (
          <div className="pt-4 border-t border-slate-700">
            <h4 className="text-sm font-medium text-slate-400 mb-2">Plan Features</h4>
            <ul className="space-y-1">
              {currentTier.features.slice(0, 3).map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle className="h-3 w-3 text-green-400 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upgrade CTA for Free Users */}
        {isFree && onUpgrade && (
          <div className="pt-4 border-t border-slate-700">
            <div className="bg-gradient-to-r from-yellow-500/10 to-purple-500/10 border border-yellow-500/20 rounded-lg p-3">
              <p className="text-sm text-yellow-400 font-medium mb-1">
                Unlock Premium Features
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Get more tokens, advanced mentors, and exclusive features
              </p>
              <button
                onClick={onUpgrade}
                className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium rounded transition-colors"
              >
                View Plans
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionStatus;