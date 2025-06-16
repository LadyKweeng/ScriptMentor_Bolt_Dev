// src/components/PricingPlans.tsx
import React, { useState } from 'react';
import { Check, Zap, Crown, Rocket, Star, ArrowRight, Loader } from 'lucide-react';
import { STRIPE_PRODUCTS, formatPrice } from '../stripe-config';
import { StripeService } from '../services/stripeService';

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
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (product: StripeProduct) => {
    if (!userId || product.price === 0 || 
        (currentTier === 'creator' && product.priceId === 'price_1RalzkEOpk1Bj1eeIqTOsYNq') ||
        (currentTier === 'professional' && product.priceId === 'price_1Ram1AEOpk1Bj1ee2sRTCp8b')) {
      return;
    }
    
    setLoadingPlan(product.priceId);
    
    try {
      const successUrl = `${window.location.origin}/subscription/success`;
      const cancelUrl = `${window.location.origin}/pricing`;
      
      const checkoutSession = await StripeService.createCheckoutSession(
        product.priceId,
        product.mode,
        successUrl,
        cancelUrl
      );
      
      if (checkoutSession?.url) {
        window.location.href = checkoutSession.url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const getPlanIcon = (product: StripeProduct) => {
    if (product.price === 0) return <Zap className="h-6 w-6" />;
    if (product.name === 'Creator') return <Star className="h-6 w-6" />;
    if (product.name === 'Pro') return <Crown className="h-6 w-6" />;
    return <Rocket className="h-6 w-6" />;
  };

  const getPlanColor = (product: StripeProduct) => {
    if (product.price === 0) return 'text-slate-400';
    if (product.name === 'Creator') return 'text-yellow-400';
    if (product.name === 'Pro') return 'text-purple-400';
    return 'text-blue-400';
  };

  const isCurrentPlan = (product: StripeProduct) => {
    if (product.price === 0 && currentTier === 'free') return true;
    if (product.name === 'Creator' && currentTier === 'creator') return true;
    if (product.name === 'Pro' && currentTier === 'professional') return true;
    return false;
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
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {STRIPE_PRODUCTS.map((product) => {
          const isPopular = product.name === 'Creator';
          const isCurrent = isCurrentPlan(product);
          const isLoading = loadingPlan === product.priceId;
          
          return (
            <div
              key={product.id}
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
                    <div className={getPlanColor(product)}>
                      {getPlanIcon(product)}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">{product.name}</h3>
                  <p className="text-slate-400 text-sm mb-4">{product.description}</p>
                  
                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-white">
                      {formatPrice(product.price || 0)}
                    </span>
                    {product.price > 0 && (
                      <span className="text-slate-400">/{product.interval}</span>
                    )}
                  </div>

                  {/* Token Count */}
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    <span className="text-lg font-semibold text-yellow-400">
                      {product.name === 'Free Tier' ? '50' : 
                       product.name === 'Creator' ? '500' : 
                       product.name === 'Pro' ? '1,500' : '0'} tokens/month
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {product.features?.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(product)}
                  disabled={isCurrent || isLoading || !userId}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 cursor-default'
                      : product.price === 0
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
                  ) : product.price === 0 ? (
                    'Free Plan'
                  ) : (
                    <>
                      Upgrade Now
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Additional Info */}
                {product.price !== 0 && (
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