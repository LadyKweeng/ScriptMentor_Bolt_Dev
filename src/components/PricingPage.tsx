// src/components/PricingPage.tsx
import React, { useState, useEffect } from 'react';
import { Check, Zap, Crown, Star, ArrowRight, Loader, X } from 'lucide-react';
import { STRIPE_PRODUCTS, StripeProduct, formatPrice } from '../stripe-config';
import { StripeService } from '../services/stripeService';
import { supabase } from '../utils/supabaseClient';

interface PricingPageProps {
  onClose?: () => void;
  currentTier?: string;
}

const PricingPage: React.FC<PricingPageProps> = ({ onClose, currentTier }) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);

  useEffect(() => {
    loadUserSubscription();
  }, []);

  const loadUserSubscription = async () => {
    try {
      const subscription = await StripeService.getUserSubscription();
      setUserSubscription(subscription);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const handleSelectPlan = async (product: StripeProduct) => {
    // Don't allow selecting free tier or current tier
    if (product.price === 0 || product.priceId === userSubscription?.priceId) {
      return;
    }
    
    setLoadingPlan(product.priceId);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Please sign in to upgrade your plan');
      }

      const checkoutSession = await StripeService.createCheckoutSession(
        product.priceId,
        product.mode
      );
      
      if (checkoutSession?.url) {
        window.location.href = checkoutSession.url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Error selecting plan:', error);
      alert(error.message || 'Failed to start checkout. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const getPlanIcon = (product: StripeProduct) => {
    if (product.price === 0) return <Zap className="h-6 w-6" />;
    if (product.popular) return <Star className="h-6 w-6" />;
    return <Crown className="h-6 w-6" />;
  };

  const getPlanColor = (product: StripeProduct) => {
    if (product.price === 0) return 'text-slate-400';
    if (product.popular) return 'text-yellow-400';
    return 'text-purple-400';
  };

  const isCurrentPlan = (product: StripeProduct) => {
    return product.priceId === userSubscription?.priceId;
  };

  const canSelectPlan = (product: StripeProduct) => {
    return product.price > 0 && !isCurrentPlan(product);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Choose Your Plan</h1>
              <p className="text-slate-400 mt-2">
                Unlock the full power of AI-driven screenplay feedback
              </p>
            </div>
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-slate-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {isLoadingSubscription ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-8 w-8 animate-spin text-yellow-400" />
            <span className="ml-3 text-slate-400">Loading subscription details...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STRIPE_PRODUCTS.map((product) => {
              const isPopular = product.popular;
              const isCurrent = isCurrentPlan(product);
              const isLoading = loadingPlan === product.priceId;
              const canSelect = canSelectPlan(product);
              
              return (
                <div
                  key={product.id}
                  className={`relative bg-slate-800 rounded-xl border-2 transition-all duration-300 ${
                    isPopular 
                      ? 'border-yellow-500 shadow-lg shadow-yellow-500/20 scale-105' 
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
                      <div className="mb-6">
                        <span className="text-3xl font-bold text-white">
                          {formatPrice(product.price || 0)}
                        </span>
                        {product.price && product.price > 0 && (
                          <span className="text-slate-400">/{product.interval}</span>
                        )}
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
                      disabled={!canSelect || isLoading}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                        isCurrent
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 cursor-default'
                          : product.price === 0
                          ? 'bg-slate-700 text-slate-400 cursor-default'
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
                    {product.price && product.price > 0 && (
                      <p className="text-xs text-slate-500 text-center mt-3">
                        Cancel anytime • Secure payment via Stripe
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Feature Comparison */}
        <div className="mt-16 bg-slate-800/50 rounded-xl p-8 border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-6 text-center">
            Why Upgrade?
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-blue-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-blue-400" />
              </div>
              <h4 className="font-medium text-white mb-2">More AI Tokens</h4>
              <p className="text-slate-400 text-sm">
                Get 10x more tokens to analyze longer scripts and get comprehensive feedback
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-6 w-6 text-purple-400" />
              </div>
              <h4 className="font-medium text-white mb-2">All Mentors</h4>
              <p className="text-slate-400 text-sm">
                Access all mentor personalities and blended feedback for diverse perspectives
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-yellow-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="h-6 w-6 text-yellow-400" />
              </div>
              <h4 className="font-medium text-white mb-2">Advanced Features</h4>
              <p className="text-slate-400 text-sm">
                Chunked analysis, writer suggestions, and priority support
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;