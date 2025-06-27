import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { subscriptionService } from '../services/subscriptionService';
import { stripeService } from '../services/stripeService';
import { products } from '../stripe-config';
import { 
  CreditCard, 
  Calendar, 
  TrendingUp, 
  Settings, 
  Download, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Crown,
  Zap,
  Shield,
  ArrowUpRight,
  RefreshCw,
  BarChart3
} from 'lucide-react';

interface SubscriptionData {
  isActive: boolean;
  tier: 'free' | 'creator' | 'pro';
  subscription?: any;
  nextBillingDate?: Date;
  daysUntilBilling?: number;
  trialStatus?: {
    inTrial: boolean;
    daysRemaining?: number;
    trialEnd?: Date;
  };
}

interface UsageAnalytics {
  tokenUsageThisMonth: number;
  averageDailyUsage: number;
  mostUsedFeatures: Array<{feature: string; usage: number}>;
  projectedMonthlyUsage: number;
  recommendedTier?: 'free' | 'creator' | 'pro';
}

const SubscriptionManagement: React.FC = () => {
  // ✅ Manual session management instead of useTokens hook
  const [session, setSession] = useState<any>(null);
  const [userTokens, setUserTokens] = useState<any>(null);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [usageAnalytics, setUsageAnalytics] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ✅ Get session manually
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      // Set placeholder token data (you can enhance this later)
      if (session?.user) {
        setUserTokens({
          balance: 50,
          tier: 'free',
          monthly_allowance: 50
        });
      }
    };
    getSession();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadSubscriptionData();
      loadUsageAnalytics();
    }
  }, [session]);

  const loadSubscriptionData = async () => {
    try {
      const data = await subscriptionService.getUserSubscriptionStatus(session!.user.id);
      setSubscriptionData(data);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    }
  };

  const loadUsageAnalytics = async () => {
    try {
      const analytics = await subscriptionService.getSubscriptionAnalytics(session!.user.id);
      setUsageAnalytics(analytics);
    } catch (error) {
      console.error('Failed to load usage analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async (newPriceId: string) => {
    try {
      setActionLoading(newPriceId);
      await stripeService.redirectToCheckout({
        priceId: newPriceId,
        mode: 'subscription',
        successUrl: `${window.location.origin}/subscription-management?success=true`,
        cancelUrl: `${window.location.origin}/subscription-management`
      });
    } catch (error) {
      console.error('Failed to change plan:', error);
      alert('Failed to change plan. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing cycle.')) {
      return;
    }

    try {
      setActionLoading('cancel');
      // Implement cancellation logic through Stripe
      alert('Cancellation functionality will be implemented through Stripe customer portal.');
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      alert('Failed to cancel subscription. Please contact support.');
    } finally {
      setActionLoading(null);
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'free': return <Shield className="h-5 w-5 text-slate-400" />;
      case 'creator': return <Zap className="h-5 w-5 text-blue-400" />;
      case 'pro': return <Crown className="h-5 w-5 text-yellow-400" />;
      default: return <Shield className="h-5 w-5 text-slate-400" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'border-slate-600 bg-slate-800/50';
      case 'creator': return 'border-blue-500/50 bg-blue-900/20';
      case 'pro': return 'border-yellow-500/50 bg-yellow-900/20';
      default: return 'border-slate-600 bg-slate-800/50';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getUsagePercentage = () => {
    if (!userTokens || !usageAnalytics) return 0;
    return Math.min((usageAnalytics.tokenUsageThisMonth / userTokens.monthly_allowance) * 100, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading subscription data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Subscription Management</h1>
          <p className="text-slate-400">Manage your plan, view usage, and update billing information</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Plan Overview */}
          <div className="lg:col-span-2">
            <div className={`rounded-xl border p-6 ${getTierColor(userTokens?.tier || 'free')}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {getTierIcon(userTokens?.tier || 'free')}
                  <div>
                    <h2 className="text-xl font-semibold text-white capitalize">
                      {userTokens?.tier || 'Free'} Plan
                    </h2>
                    <p className="text-slate-400 text-sm">
                      {subscriptionData?.isActive ? 'Active Subscription' : 'Free Tier'}
                    </p>
                  </div>
                </div>
                
                {subscriptionData?.trialStatus?.inTrial && (
                  <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                    Trial: {subscriptionData.trialStatus.daysRemaining} days left
                  </div>
                )}
              </div>

              {/* Token Usage Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">Monthly Token Usage</span>
                  <span className="text-sm text-slate-400">
                    {usageAnalytics?.tokenUsageThisMonth || 0} / {userTokens?.monthly_allowance || 0}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${getUsagePercentage()}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Average daily usage: {usageAnalytics?.averageDailyUsage || 0} tokens
                </p>
              </div>

              {/* Billing Information */}
              {subscriptionData?.isActive && subscriptionData.nextBillingDate && (
                <div className="border-t border-slate-700 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-300">Next billing date</span>
                    </div>
                    <span className="text-sm text-white">
                      {formatDate(subscriptionData.nextBillingDate)}
                    </span>
                  </div>
                  {subscriptionData.daysUntilBilling && (
                    <p className="text-xs text-slate-400 mt-1">
                      {subscriptionData.daysUntilBilling} days remaining in current billing cycle
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Usage Analytics */}
            {usageAnalytics && (
              <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Usage Analytics
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Most Used Features */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Most Used Features</h4>
                    <div className="space-y-2">
                      {usageAnalytics.mostUsedFeatures.slice(0, 3).map((feature, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">{feature.feature}</span>
                          <span className="text-sm text-white">{feature.usage} times</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Projections */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Monthly Projection</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Projected usage</span>
                        <span className="text-sm text-white">{usageAnalytics.projectedMonthlyUsage} tokens</span>
                      </div>
                      {usageAnalytics.recommendedTier && usageAnalytics.recommendedTier !== userTokens?.tier && (
                        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <p className="text-xs text-blue-300">
                            Consider upgrading to {usageAnalytics.recommendedTier} for better value
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions Panel */}
          <div className="space-y-6">
            {/* Plan Options */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Available Plans</h3>
              
              <div className="space-y-3">
                {products.map((product) => {
                  const isCurrentPlan = userTokens?.tier === product.name.toLowerCase();
                  const canUpgrade = !isCurrentPlan;
                  
                  return (
                    <div 
                      key={product.id}
                      className={`p-4 rounded-lg border transition-all ${
                        isCurrentPlan 
                          ? 'border-blue-500/50 bg-blue-900/20' 
                          : 'border-slate-600 bg-slate-800/30 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {getTierIcon(product.name.toLowerCase())}
                            <span className="font-medium text-white">{product.name}</span>
                            {isCurrentPlan && (
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 mt-1">
                            {product.features[0]} {/* Show main feature */}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-medium text-white">
                            {product.price === 0 ? 'Free' : `$${product.price}/mo`}
                          </div>
                          {canUpgrade && (
                            <button
                              onClick={() => handlePlanChange(product.priceId)}
                              disabled={actionLoading === product.priceId}
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1"
                            >
                              {actionLoading === product.priceId ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  {userTokens?.tier === 'free' ? 'Upgrade' : 'Change'}
                                  <ArrowUpRight className="h-3 w-3" />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Account Actions */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Account Actions</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    // Simple refresh - reload the page to refresh token data
                    window.location.reload();
                  }}
                  className="w-full flex items-center gap-2 p-3 text-left text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Token Balance
                </button>

                <button className="w-full flex items-center gap-2 p-3 text-left text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
                  <Download className="h-4 w-4" />
                  Download Billing History
                </button>

                <button className="w-full flex items-center gap-2 p-3 text-left text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
                  <CreditCard className="h-4 w-4" />
                  Update Payment Method
                </button>

                {subscriptionData?.isActive && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={actionLoading === 'cancel'}
                    className="w-full flex items-center gap-2 p-3 text-left text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    {actionLoading === 'cancel' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Current Balance</span>
                  <span className="text-sm font-medium text-white">{userTokens?.balance || 0} tokens</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Monthly Allowance</span>
                  <span className="text-sm font-medium text-white">{userTokens?.monthly_allowance || 0} tokens</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Account Status</span>
                  <div className="flex items-center gap-1">
                    {subscriptionData?.isActive ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-400" />
                        <span className="text-sm text-green-400">Active</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 text-yellow-400" />
                        <span className="text-sm text-yellow-400">Free Tier</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManagement;