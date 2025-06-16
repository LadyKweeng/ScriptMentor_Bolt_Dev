// src/components/PricingPlans.tsx
import React, { useState } from 'react';
import { Check, Zap, Crown, Rocket, Star, ArrowRight, Loader } from 'lucide-react';
import { SUBSCRIPTION_TIERS } from '../data/subscriptionTiers';
import { SubscriptionService } from '../services/subscriptionService';

interface PricingPlansProps {
  currentTier?: string;
  onSelectPlan?: (tierId: string) => void;
  userId?: string;
}

const PricingPlans: React.FC<PricingPlansProps> = ({ 
  currentTier = 'free', 
  onSelectPlan,
  userId 
}) => {
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const filteredTiers = SUBSCRIPTION_TIERS.filter(tier => 
    tier.interval === billingInterval || tier.id === 'free'
  );

  const handleSelectPlan = async (tierId: string) => {
    if (!userId || tierId === 'free' || tierId === currentTier) return;
    
    setLoadingPlan(tierId);
    
    try {
      const successUrl = `${window.location.origin}/subscription/success`;
      const cancelUrl = `${window.location.origin}/pricing`;
      
      const session = await SubscriptionService.createCheckoutSession(
        userId,
        tierId,
        successUrl,
        cancelUrl
      );
      
      if (session?.url) {
        window.location.href = session.url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
    
    if (onSelectPlan) {
      onSelectPlan(tierId);
    }
  };

  const formatPrice = (price: number, interval: string) => {
    if (price === 0) return 'Free';
    const dollars = price / 100;
    return `$${dollars.toFixed(0)}/${interval}`;
  };

  const getYearlySavings = (monthlyPrice: number, yearlyPrice: number) => {
    const monthlyCost = (monthlyPrice * 12) / 100;
    const yearlyCost = yearlyPrice / 100;
    const savings = monthlyCost - yearlyCost;
    return Math.round((savings / monthlyCost) * 100);
  };

  const getPlanIcon = (tierId: string) => {
    switch (tierId) {
      case 'free': return <Zap className="h-6 w-6" />;
      case 'creator': 
      case 'creator_yearly': return <Star className="h-6 w-6" />;
      case 'professional':
      case 'professional_yearly': return <Crown className="h-6 w-6" />;
      default: return <Rocket className="h-6 w-6" />;
    }
  };

  const getPlanColor = (tierId: string) => {
    switch (tierId) {
      case 'free': return 'text-slate-400';
      case 'creator':
      case 'creator_yearly': return 'text-yellow-400';
      case 'professional':
      case 'professional_yearly': return 'text-purple-400';
      default: return 'text-blue-400';
    }
  };

  const isCurrentPlan = (tierId: string) => {
    return tierId === currentTier || 
           (currentTier === 'creator' && tierId === 'creator_yearly') ||
           (currentTier === 'professional' && tierId === 'professional_yearly');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-white mb-4">
          Choose Your ScriptMentor Plan
        </h2>
        <p className="text-xl text-slate-400 mb-8">
          Get AI-powered screenplay feedback with token-based pricing
        </p>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className={`text-sm ${billingInterval === 'month' ? 'text-white' : 'text-slate-400'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingInterval(billingInterval === 'month' ? 'year' : 'month')}
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingInterval === 'year' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm ${billingInterval === 'year' ? 'text-white' : 'text-slate-400'}`}>
            Yearly
          </span>
          {billingInterval === 'year' && (
            <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-medium border border-green-500/30">
              Save 20%
            </span>
          )}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {filteredTiers.map((tier) => {
          const isPopular = tier.popular;
          const isCurrent = isCurrentPlan(tier.id);
          const isLoading = loadingPlan === tier.id;
          
          return (
            <div
              key={tier.id}
              className={`relative bg-slate-800 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                isPopular 
                  ? 'border-yellow-500 shadow-lg shadow-yellow-500/20' 
                  : 'border-slate-700 hover:border-slate-600'
              } ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-yellow-500 text-slate-900 px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrent && (
                <div className="absolute -top-4 right-4">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="p-6">
                {/* Plan Header */}
                <div className="text-center mb-6">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 ${
                    isPopular ? 'bg-yellow-500/20' : 'bg-slate-700'
                  }`}>
                    <div className={getPlanColor(tier.id)}>
                      {getPlanIcon(tier.id)}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                  <p className="text-slate-400 text-sm mb-4">{tier.description}</p>
                  
                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-white">
                      {formatPrice(tier.price, tier.interval)}
                    </span>
                    {tier.price > 0 && billingInterval === 'year' && (
                      <div className="text-sm text-green-400 mt-1">
                        Save {getYearlySavings(
                          SUBSCRIPTION_TIERS.find(t => t.id === tier.id.replace('_yearly', ''))?.price || 0,
                          tier.price
                        )}% vs monthly
                      </div>
                    )}
                  </div>

                  {/* Token Count */}
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    <span className="text-lg font-semibold text-yellow-400">
                      {tier.tokens.toLocaleString()} tokens/month
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(tier.id)}
                  disabled={isCurrent || isLoading || !userId}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 cursor-default'
                      : tier.id === 'free'
                      ? 'bg-slate-700 hover:bg-slate-600 text-white'
                      : isPopular
                      ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-900 shadow-lg hover:shadow-xl'
                      : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 hover:border-slate-500'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : tier.id === 'free' ? (
                    'Get Started Free'
                  ) : (
                    <>
                      Upgrade Now
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Additional Info */}
                {tier.id !== 'free' && (
                  <p className="text-xs text-slate-500 text-center mt-3">
                    Cancel anytime • Secure payment via Stripe
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Token Usage Guide */}
      <div className="mt-16 bg-slate-800/50 rounded-xl p-8 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-6 text-center">
          How Tokens Work
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="bg-blue-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="h-6 w-6 text-blue-400" />
            </div>
            <h4 className="font-medium text-white mb-2">Single Scene Feedback</h4>
            <p className="text-slate-400 text-sm">5 tokens per scene analysis</p>
          </div>
          
          <div className="text-center">
            <div className="bg-purple-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="h-6 w-6 text-purple-400" />
            </div>
            <h4 className="font-medium text-white mb-2">Chunked Analysis</h4>
            <p className="text-slate-400 text-sm">10 + 3 tokens per chunk</p>
          </div>
          
          <div className="text-center">
            <div className="bg-yellow-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="h-6 w-6 text-yellow-400" />
            </div>
            <h4 className="font-medium text-white mb-2">Blended Feedback</h4>
            <p className="text-slate-400 text-sm">8 + 2 tokens per chunk</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPlans;