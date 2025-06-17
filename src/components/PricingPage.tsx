import React, { useState } from 'react';
import { products } from '../stripe-config';
import { stripeService } from '../services/stripeService';
import { Check, Star, Loader } from 'lucide-react';

const PricingPage: React.FC = () => {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string, mode: 'subscription' | 'payment') => {
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

  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white mb-4">
            Choose Your ScriptMentor Plan
          </h1>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Get AI-powered screenplay feedback from industry-inspired mentors. 
            Choose the plan that fits your writing journey.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {products.map((product) => (
            <div
              key={product.id}
              className={`relative bg-slate-800 rounded-2xl p-8 border-2 transition-all duration-300 hover:scale-105 ${
                product.popular
                  ? 'border-yellow-400 shadow-lg shadow-yellow-400/20'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              {/* Popular Badge */}
              {product.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-yellow-400 text-slate-900 px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    Most Popular
                  </div>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {product.name}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">
                    {formatPrice(product.price, product.currency)}
                  </span>
                  {product.interval && product.price > 0 && (
                    <span className="text-slate-400 ml-2">
                      /{product.interval}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Features */}
              <div className="mb-8">
                <ul className="space-y-3">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => handleSubscribe(product.priceId, product.mode)}
                disabled={loadingPriceId === product.priceId}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                  product.popular
                    ? 'bg-yellow-400 hover:bg-yellow-300 text-slate-900'
                    : product.price === 0
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                } ${
                  loadingPriceId === product.priceId
                    ? 'opacity-75 cursor-not-allowed'
                    : 'hover:scale-105'
                }`}
              >
                {loadingPriceId === product.priceId ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {product.price === 0 ? 'Get Started Free' : 'Subscribe Now'}
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                What are tokens?
              </h3>
              <p className="text-slate-400">
                Tokens are used to generate AI feedback on your scripts. Each analysis 
                consumes tokens based on the length and complexity of your screenplay.
              </p>
            </div>
            
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Can I change my plan anytime?
              </h3>
              <p className="text-slate-400">
                Yes! You can upgrade or downgrade your plan at any time. Changes will 
                be reflected in your next billing cycle.
              </p>
            </div>
            
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                What's the difference between mentors?
              </h3>
              <p className="text-slate-400">
                Each mentor has a unique perspective inspired by industry professionals. 
                Higher tiers give you access to more mentors and blended feedback that 
                combines multiple viewpoints.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;