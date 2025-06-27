import React, { useState, useEffect } from 'react';
import { products } from '../stripe-config';
import { stripeService } from '../services/stripeService';
import { supabase } from '../utils/supabaseClient';
import { Check, Star, Loader, ArrowRight, Zap, Crown, Shield, TrendingUp, Users, Clock, Sparkles } from 'lucide-react';

const PricingPage: React.FC = () => {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [session, setSession] = useState<any>(null);
  const [userTokens, setUserTokens] = useState<any>(null);

  // Get user session and tokens
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, []);

  const handleSubscribe = async (priceId: string, mode: 'subscription' | 'payment') => {
    if (!session?.user) {
      alert('Please sign in to subscribe');
      return;
    }

    try {
      setLoadingPriceId(priceId);

      await stripeService.redirectToCheckout({
        priceId,
        mode,
        successUrl: `${window.location.origin}/success`,
        cancelUrl: `${window.location.origin}/pricing`
      });
    } catch (error) {
      console.error('Failed to start checkout:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoadingPriceId(null);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return 'Free';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(price);
  };

  // Calculate annual savings (typically 20% discount)
  const getAnnualPrice = (monthlyPrice: number) => monthlyPrice * 12 * 0.8;
  const getAnnualSavings = (monthlyPrice: number) => monthlyPrice * 12 * 0.2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Enhanced Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />

        <div className="relative max-w-7xl mx-auto px-4 pt-16 pb-12">
          {/* Header Content */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-6">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-blue-300 text-sm font-medium">Professional Screenplay Feedback</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Choose Your
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"> Writing Journey</span>
            </h1>

            <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Get industry-level screenplay feedback from AI mentors inspired by legendary screenwriters.
              Transform your scripts with professional insights that accelerate your growth.
            </p>

            {/* Social Proof */}
            <div className="flex items-center justify-center gap-8 mt-8 text-slate-400">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span className="text-sm">1,200+ Writers</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm">500K+ Feedback Sessions</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span className="text-sm">24/7 Available</span>
              </div>
            </div>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-12">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-2 border border-slate-700">
              <div className="flex items-center">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                    billingCycle === 'annual'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Annual
                  <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {products.map((product, index) => {
              const isPopular = product.popular;
              const isCurrentTier = userTokens?.tier === product.name.toLowerCase();
              const price = billingCycle === 'annual' && product.price > 0 
                ? getAnnualPrice(product.price) 
                : product.price;
              const savings = billingCycle === 'annual' && product.price > 0 
                ? getAnnualSavings(product.price) 
                : 0;

              return (
                <div
                  key={product.id}
                  className={`relative group transition-all duration-500 hover:scale-105 ${
                    isPopular ? 'md:-mt-4 md:mb-4' : ''
                  }`}
                >
                  {/* Popular Badge */}
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-slate-900 px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
                        <Star className="h-4 w-4" />
                        Most Popular
                      </div>
                    </div>
                  )}

                  {/* Card */}
                  <div className={`relative h-full bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border transition-all duration-300 ${
                    isPopular
                      ? 'border-yellow-400/50 shadow-2xl shadow-yellow-400/10'
                      : 'border-slate-700 hover:border-slate-600'
                  } ${isCurrentTier ? 'ring-2 ring-blue-400/50' : ''}`}>
                    
                    {/* Tier Icon */}
                    <div className="mb-6">
                      {product.name === 'Free Tier' && (
                        <div className="h-12 w-12 bg-slate-700 rounded-xl flex items-center justify-center">
                          <Shield className="h-6 w-6 text-slate-300" />
                        </div>
                      )}
                      {product.name === 'Creator' && (
                        <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                          <Zap className="h-6 w-6 text-white" />
                        </div>
                      )}
                      {product.name === 'Pro' && (
                        <div className="h-12 w-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-xl flex items-center justify-center">
                          <Crown className="h-6 w-6 text-slate-900" />
                        </div>
                      )}
                    </div>

                    {/* Current Tier Badge */}
                    {isCurrentTier && (
                      <div className="absolute top-4 right-4">
                        <span className="bg-blue-500/20 text-blue-400 text-xs px-3 py-1 rounded-full font-medium">
                          Current Plan
                        </span>
                      </div>
                    )}

                    {/* Plan Details */}
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-white mb-2">{product.name}</h3>
                      <p className="text-slate-400 text-sm leading-relaxed mb-6">{product.description}</p>
                      
                      {/* Pricing */}
                      <div className="mb-6">
                        {billingCycle === 'annual' && product.price > 0 ? (
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-bold text-white">
                                {formatPrice(price / 12, product.currency)}
                              </span>
                              <span className="text-slate-400">/month</span>
                            </div>
                            <div className="text-sm text-slate-400 mt-1">
                              <span className="line-through">{formatPrice(product.price, product.currency)}/month</span>
                              <span className="text-green-400 ml-2">Save {formatPrice(savings, product.currency)}/year</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold text-white">
                              {formatPrice(product.price, product.currency)}
                            </span>
                            {product.price > 0 && (
                              <span className="text-slate-400">/month</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-3 mb-8">
                      {product.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                            isPopular ? 'bg-yellow-400/20' : 'bg-green-500/20'
                          }`}>
                            <Check className={`h-3 w-3 ${
                              isPopular ? 'text-yellow-400' : 'text-green-400'
                            }`} />
                          </div>
                          <span className="text-slate-300 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={() => handleSubscribe(product.priceId, product.mode)}
                      disabled={loadingPriceId === product.priceId || isCurrentTier}
                      className={`w-full py-4 px-6 rounded-xl font-semibold text-center transition-all duration-300 flex items-center justify-center gap-2 group ${
                        isCurrentTier
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                          : isPopular
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-slate-900 hover:from-yellow-300 hover:to-orange-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                      }`}
                    >
                      {loadingPriceId === product.priceId ? (
                        <>
                          <Loader className="h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : isCurrentTier ? (
                        'Current Plan'
                      ) : (
                        <>
                          {product.name === 'Free Tier' ? 'Get Started' : 'Upgrade Now'}
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trust Indicators */}
          <div className="text-center mt-16">
            <p className="text-slate-400 text-sm mb-4">Trusted by screenwriters worldwide</p>
            <div className="flex items-center justify-center gap-2 text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-current" />
              ))}
              <span className="text-slate-300 ml-2">4.9/5 from 1,200+ reviews</span>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-20 max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-white text-center mb-8">Frequently Asked Questions</h3>
            <div className="space-y-6">
              <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <h4 className="text-lg font-semibold text-white mb-2">What are tokens and how do they work?</h4>
                <p className="text-slate-300 text-sm">
                  Tokens are credits used for AI feedback generation. Each action (like getting mentor feedback) costs tokens. 
                  Your monthly allowance resets automatically each billing cycle.
                </p>
              </div>
              
              <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <h4 className="text-lg font-semibold text-white mb-2">Can I change plans anytime?</h4>
                <p className="text-slate-300 text-sm">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
                  and you'll be charged prorated amounts for upgrades.
                </p>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <h4 className="text-lg font-semibold text-white mb-2">What makes your AI mentors different?</h4>
                <p className="text-slate-300 text-sm">
                  Our mentors are trained on industry-standard screenplay principles and inspired by legendary screenwriters' 
                  approaches. They provide structured, actionable feedback rather than generic suggestions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;