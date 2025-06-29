// src/components/EmergencyTopUpModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  Zap, 
  TrendingUp, 
  Clock,
  ShoppingCart,
  Crown,
  Star,
  Gift,
  ArrowRight
} from 'lucide-react';
import { TokenPurchase } from './TokenPurchase';
import { tokenPackages, getTokensFromPriceId, getDiscountedPrice } from '../stripe-config';
import { stripeService } from '../services/stripeService';
import { supabase } from '../utils/supabaseClient';

interface EmergencyTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentBalance: number;
  currentTier: 'free' | 'creator' | 'pro';
  trigger: 'insufficient_tokens' | 'critical_balance' | 'zero_balance' | 'monthly_limit_warning';
  requiredTokens?: number;
  actionName?: string;
  daysUntilReset?: number;
}

export const EmergencyTopUpModal: React.FC<EmergencyTopUpModalProps> = ({
  isOpen,
  onClose,
  userId,
  currentBalance,
  currentTier,
  trigger,
  requiredTokens = 0,
  actionName = 'this action',
  daysUntilReset = 0
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [selectedQuickBuy, setSelectedQuickBuy] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, []);

  if (!isOpen) return null;

  const getModalContent = () => {
    switch (trigger) {
      case 'insufficient_tokens':
        return {
          icon: <AlertTriangle className="h-8 w-8 text-red-500" />,
          title: 'Insufficient Tokens',
          subtitle: `You need ${requiredTokens} tokens for ${actionName}, but only have ${currentBalance}`,
          urgency: 'high',
          buttonText: 'Get Tokens Now'
        };
      case 'critical_balance':
        return {
          icon: <AlertTriangle className="h-8 w-8 text-yellow-500" />,
          title: 'Critical Token Balance',
          subtitle: `You're running low with only ${currentBalance} tokens remaining`,
          urgency: 'medium',
          buttonText: 'Top Up Tokens'
        };
      case 'zero_balance':
        return {
          icon: <AlertTriangle className="h-8 w-8 text-red-600" />,
          title: 'No Tokens Remaining',
          subtitle: 'You\'ve used all your tokens and need more to continue',
          urgency: 'critical',
          buttonText: 'Purchase Tokens'
        };
      case 'monthly_limit_warning':
        return {
          icon: <Clock className="h-8 w-8 text-orange-500" />,
          title: 'Monthly Limit Warning',
          subtitle: `You've used most of your monthly tokens with ${daysUntilReset} days until reset`,
          urgency: 'low',
          buttonText: 'Get Extra Tokens'
        };
      default:
        return {
          icon: <Zap className="h-8 w-8 text-blue-500" />,
          title: 'Token Top-Up',
          subtitle: 'Get more tokens to continue using Script Mentor',
          urgency: 'low',
          buttonText: 'Purchase Tokens'
        };
    }
  };

  const getRecommendedPackage = () => {
    const needed = Math.max(requiredTokens - currentBalance, 0);
    
    // Find the smallest package that covers the deficit
    const suitablePackages = tokenPackages.filter(pkg => 
      getTokensFromPriceId(pkg.priceId) >= needed
    ).sort((a, b) => 
      getTokensFromPriceId(a.priceId) - getTokensFromPriceId(b.priceId)
    );

    // If no deficit or critical balance, recommend Power Pack (best value)
    if (needed === 0 || trigger === 'critical_balance') {
      return tokenPackages.find(pkg => pkg.name === 'Power Pack')?.id;
    }

    return suitablePackages[0]?.id || tokenPackages[1]?.id; // Default to Power Pack
  };

  const handleQuickPurchase = async (priceId: string, packageName: string) => {
    if (!session?.user) {
      alert('Please sign in to purchase tokens');
      return;
    }

    try {
      setLoading(priceId);
      setSelectedQuickBuy(priceId);

      await stripeService.redirectToCheckout({
        priceId,
        mode: 'payment',
        successUrl: `${window.location.origin}/success?purchase=emergency&package=${packageName}`,
        cancelUrl: window.location.href
      });
    } catch (error) {
      console.error('Failed to start emergency purchase:', error);
      alert('Failed to start purchase. Please try again.');
      setLoading(null);
      setSelectedQuickBuy(null);
    }
  };

  const content = getModalContent();
  const recommendedPackageId = getRecommendedPackage();

  // Quick buy options - top 2 packages based on context
  const getQuickBuyOptions = () => {
    if (trigger === 'insufficient_tokens') {
      // Show packages that would solve the immediate problem
      return tokenPackages.filter(pkg => 
        getTokensFromPriceId(pkg.priceId) >= (requiredTokens - currentBalance)
      ).slice(0, 2);
    }
    // For other triggers, show popular options
    return [
      tokenPackages.find(pkg => pkg.name === 'Power Pack'),
      tokenPackages.find(pkg => pkg.name === 'Pro Pack')
    ].filter(Boolean);
  };

  const quickBuyOptions = getQuickBuyOptions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {content.icon}
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {content.title}
              </h2>
              <p className="text-slate-600">
                {content.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Quick Action Section */}
        {trigger === 'insufficient_tokens' && quickBuyOptions.length > 0 && (
          <div className="p-6 bg-red-50 border-b border-red-200">
            <h3 className="text-lg font-semibold text-red-800 mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Solution
            </h3>
            <p className="text-red-700 mb-4">
              You need {requiredTokens - currentBalance} more tokens to {actionName}. 
              Get them instantly with these options:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickBuyOptions.map((pkg) => {
                if (!pkg) return null;
                const tokens = getTokensFromPriceId(pkg.priceId);
                const finalPrice = getDiscountedPrice(pkg.price, currentTier);
                const isDiscounted = currentTier === 'pro';

                return (
                  <button
                    key={pkg.id}
                    onClick={() => handleQuickPurchase(pkg.priceId, pkg.name)}
                    disabled={loading === pkg.priceId}
                    className="p-4 bg-white border-2 border-red-300 rounded-lg hover:border-red-400 hover:shadow-md transition-all duration-200 text-left group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-slate-800">{pkg.name}</h4>
                      {pkg.popular && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl font-bold text-purple-600">{tokens}</span>
                      <span className="text-sm text-slate-600">tokens</span>
                      <div className="flex items-center gap-1 ml-auto">
                        {isDiscounted && (
                          <span className="text-sm text-slate-500 line-through">
                            ${pkg.price}
                          </span>
                        )}
                        <span className="text-lg font-semibold">${finalPrice}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-600 font-medium">
                        ✓ Solves your token shortage
                      </span>
                      <ArrowRight className="h-4 w-4 text-red-500 group-hover:text-red-600" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Status */}
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-slate-800">{currentBalance}</div>
              <div className="text-sm text-slate-600">Current Balance</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{requiredTokens}</div>
              <div className="text-sm text-slate-600">Tokens Needed</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${
                currentBalance >= requiredTokens ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.max(0, requiredTokens - currentBalance)}
              </div>
              <div className="text-sm text-slate-600">Shortfall</div>
            </div>
          </div>
        </div>

        {/* Token Purchase Options */}
        <div className="p-6">
          <TokenPurchase
            userId={userId}
            currentBalance={currentBalance}
            currentTier={currentTier}
            recommendedPackage={recommendedPackageId}
            showTitle={false}
            onPurchaseStart={() => {
              // Modal will close when redirecting to Stripe
            }}
            onPurchaseComplete={() => {
              onClose();
            }}
          />
        </div>

        {/* Alternative Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="text-sm text-slate-600">
              {trigger === 'insufficient_tokens' && (
                "Can't purchase right now? Try a different mentor or wait for your monthly reset."
              )}
              {trigger === 'critical_balance' && (
                "Consider upgrading your subscription for more monthly tokens."
              )}
              {trigger === 'zero_balance' && (
                "Your monthly tokens will reset in " + (daysUntilReset || 0) + " days."
              )}
              {trigger === 'monthly_limit_warning' && (
                "You can also wait for your monthly reset or upgrade your plan."
              )}
            </div>
            
            <div className="flex gap-2">
              {currentTier === 'free' && (
                <button
                  onClick={() => {
                    // Navigate to subscription plans
                    onClose();
                    console.log('Navigate to subscription plans');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors duration-200 flex items-center gap-2"
                >
                  <Crown className="h-4 w-4" />
                  Upgrade Plan
                </button>
              )}
              
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md text-sm transition-colors duration-200"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};