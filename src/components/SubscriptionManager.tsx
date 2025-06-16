// src/components/SubscriptionManager.tsx
import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink,
  Loader,
  Crown,
  Zap,
  TrendingUp
} from 'lucide-react';
import { SubscriptionService } from '../services/subscriptionService';
import { UserSubscription, UserTokenBalance } from '../types/subscription';
import { SUBSCRIPTION_TIERS } from '../data/subscriptionTiers';
import TokenBalance from './TokenBalance';

interface SubscriptionManagerProps {
  userId: string;
  onUpgrade?: () => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ userId, onUpgrade }) => {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [tokenBalance, setTokenBalance] = useState<UserTokenBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, [userId]);

  const loadSubscriptionData = async () => {
    try {
      const [subData, tokenData] = await Promise.all([
        SubscriptionService.getUserSubscription(userId),
        SubscriptionService.getUserTokenBalance(userId)
      ]);
      
      setSubscription(subData);
      setTokenBalance(tokenData);
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    
    try {
      const returnUrl = window.location.href;
      const portal = await SubscriptionService.createPortalSession(userId, returnUrl);
      
      if (portal?.url) {
        window.open(portal.url, '_blank');
      } else {
        throw new Error('Failed to create portal session');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const getCurrentTier = () => {
    if (!subscription) return SUBSCRIPTION_TIERS.find(tier => tier.id === 'free');
    return SUBSCRIPTION_TIERS.find(tier => tier.id === subscription.tierId);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'trialing': return 'text-blue-400';
      case 'past_due': return 'text-yellow-400';
      case 'canceled': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'trialing': return <Clock className="h-4 w-4" />;
      case 'past_due': return <AlertTriangle className="h-4 w-4" />;
      case 'canceled': return <AlertTriangle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
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

  const currentTier = getCurrentTier();
  const isFree = !subscription || subscription.tierId === 'free';

  return (
    <div className="space-y-6">
      {/* Token Balance */}
      <TokenBalance 
        userId={userId} 
        onUpgrade={onUpgrade}
      />

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
              disabled={isLoadingPortal}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {isLoadingPortal ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {isLoadingPortal ? 'Loading...' : 'Manage Billing'}
              {!isLoadingPortal && <ExternalLink className="h-3 w-3" />}
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
                <p className="font-medium text-white">{currentTier?.name || 'Free'}</p>
                <p className="text-sm text-slate-400">{currentTier?.description}</p>
              </div>
            </div>
          </div>

          {subscription && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Status</h4>
              <div className="flex items-center gap-2">
                <div className={getStatusColor(subscription.status)}>
                  {getStatusIcon(subscription.status)}
                </div>
                <span className={`font-medium capitalize ${getStatusColor(subscription.status)}`}>
                  {subscription.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Subscription Info */}
        {subscription && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Current Period</h4>
                <div className="flex items-center gap-2 text-white">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>{formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}</span>
                </div>
              </div>

              {subscription.cancelAtPeriodEnd && (
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Cancellation</h4>
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Cancels on {formatDate(subscription.currentPeriodEnd)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
      {currentTier && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="font-medium text-white mb-4">Plan Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentTier.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;