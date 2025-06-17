// src/components/PricingPage.tsx
import React, { useState } from 'react';
import { stripeService } from '../services/stripeService';
import { Check, Zap, Crown, Gift } from 'lucide-react';

const PricingPage: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string, planName: string) => {
    setLoading(planName);
    try {
      const { url } = await stripeService.createCheckoutSession(priceId);
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setLoading(null);
    }
  };

  const plans = [
    {
      name: 'Free Tier',
      price: '$0',
      period: '/month',
      description: '50 tokens/month. Access to single mentor feedback only.',
      features: [
        '50 tokens per month',
        'Single mentor feedback',
        'Basic script analysis',
        'Community support'
      ],
      icon: Gift,
      buttonText: 'Current Plan',
      disabled: true,
      priceId: null
    },
    {
      name: 'Creator',
      price: '$19.99',
      period: '/month',
      description: '500 tokens per month. Access to all mentor personalities.',
      features: [
        '500 tokens per month',
        'All mentor personalities',
        'Blended feedback mode',
        'Writer Agent analysis',
        'Priority support'
      ],
      icon: Zap,
      buttonText: 'Subscribe',
      popular: true,
      priceId: 'price_creator_monthly'
    },
    {
      name: 'Pro',
      price: '$49.99',
      period: '/month',
      description: '1,500 tokens/month with 30% token discount.',
      features: [
        '1,500 tokens per month',
        '30% token discount',
        'Everything from Creator',
        'Advanced analytics',
        'Premium support'
      ],
      icon: Crown,
      buttonText: 'Subscribe',
      priceId: 'price_pro_monthly'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-slate-400">
            Get AI-powered screenplay feedback from industry mentors
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative bg-slate-800 rounded-xl p-8 border ${
                  plan.popular
                    ? 'border-yellow-400 ring-2 ring-yellow-400/20'
                    : 'border-slate-700'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-yellow-400 text-slate-900 px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <Icon className="h-12 w-12 mx-auto mb-4 text-yellow-400" />
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-slate-400">{plan.period}</span>
                  </div>
                  <p className="text-slate-400">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                      <span className="text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => plan.priceId && handleSubscribe(plan.priceId, plan.name)}
                  disabled={plan.disabled || loading === plan.name}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                    plan.disabled
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-yellow-400 text-slate-900 hover:bg-yellow-300'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {loading === plan.name ? 'Loading...' : plan.buttonText}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PricingPage;