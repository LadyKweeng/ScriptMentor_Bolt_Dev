// src/components/TokenPurchase.tsx
import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Zap, 
  Crown, 
  Star,
  Check,
  Loader,
  AlertCircle,
  Gift,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { tokenPackages, getDiscountedPrice, getTokensFromPriceId } from '../stripe-config';
import { stripeService } from '../services/stripeService';
import { useTokens } from '../hooks/useTokens';
import { supabase } from '../utils/supabaseClient';

interface TokenPurchaseProps {
  userId: string;
  currentBalance: number;
  currentTier: 'free' | 'creator' | 'pro';
  onPurchaseStart?: () => void;
  onPurchaseComplete?: () => void;
  showTitle?: boolean;
  compact?: boolean;
  recommendedPackage?: string; // Package ID to highlight
  className?: string;
}

export const TokenPurchase: React.FC<TokenPurchaseProps> = ({
  userId,
  currentBalance,
  currentTier,
  onPurchaseStart,
  onPurchaseComplete,
  showTitle = true,
  compact = false,
  recommendedPackage,
  className = ''
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const { refreshTokens } = useTokens({ userId, autoRefresh: false });

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, []);

  const handlePurchase = async (priceId: string, packageName: string) => {
    if (!session?.user) {
      alert('Please sign in to purchase tokens');
      return;
    }

    try {
      setLoading(priceId);
      onPurchaseStart?.();

      await stripeService.redirectToCheckout({
        priceId,
        mode: 'payment',
        successUrl: `${window.location.origin}/success?purchase=tokens&package=${packageName}`,
        cancelUrl: window.location.href
      });
    } catch (error) {
      console.error('Failed to start token purchase:', error);
      alert('Failed to start purchase process. Please try again.');
      setLoading(null);
    }
  };

  const getPackageIcon = (packageName: string) => {
    switch (packageName) {
      case 'Starter Pack': return <Zap className="h-5 w-5" />;
      case 'Power Pack': return <Star className="h-5 w-5" />;
      case 'Pro Pack': return <Crown className="h-5 w-5" />;
      case 'Ultimate Pack': return <Sparkles className="h-5 w-5" />;
      default: return <ShoppingCart className="h-5 w-5" />;
    }
  };

  const getPackageColor = (packageName: string, isRecommended: boolean) => {
    if (isRecommended) {
      return 'border-purple-500 bg-purple-50';
    }
    
    switch (packageName) {
      case 'Starter Pack': return 'border-blue-200 bg-blue-50';
      case 'Power Pack': return 'border-green-200 bg-green-50';
      case 'Pro Pack': return 'border-purple-200 bg-purple-50';
      case 'Ultimate Pack': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-slate-200 bg-slate-50';
    }
  };

  const getValuePerToken = (price: number, tokens: number): string => {
    return (price / tokens).toFixed(3);
  };

  const getBestValuePackage = () => {
    return tokenPackages.reduce((best, current) => {
      const currentTokens = getTokensFromPriceId(current.priceId);
      const bestTokens = getTokensFromPriceId(best.priceId);
      const currentValue = current.price / currentTokens;
      const bestValue = best.price / bestTokens;
      return currentValue < bestValue ? current : best;
    });
  };

  const bestValue = getBestValuePackage();

  if (compact) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`}>
        {tokenPackages.slice(0, 2).map((pkg) => {
          const tokens = getTokensFromPriceId(pkg.priceId);
          const finalPrice = getDiscountedPrice(pkg.price, currentTier);
          const isDiscounted = currentTier === 'pro';
          const isRecommended = pkg.id === recommendedPackage;

          return (
            <div
              key={pkg.id}
              className={`relative p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${getPackageColor(pkg.name, isRecommended)}`}
            >
              {isRecommended && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Recommended
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getPackageIcon(pkg.name)}
                  <h3 className="font-semibold text-sm">{pkg.name}</h3>
                </div>
                {pkg.popular && (
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                    Popular
                  </span>
                )}
              </div>

              <div className="mb-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{tokens}</span>
                  <span className="text-sm text-slate-600">tokens</span>
                </div>
                <div className="flex items-center gap-2">
                  {isDiscounted && (
                    <span className="text-sm text-slate-500 line-through">
                      ${pkg.price}
                    </span>
                  )}
                  <span className="text-lg font-semibold">
                    ${finalPrice}
                  </span>
                  {isDiscounted && (
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                      30% OFF
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handlePurchase(pkg.priceId, pkg.name)}
                disabled={loading === pkg.priceId}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
              >
                {loading === pkg.priceId ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Purchase
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {showTitle && (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Purchase Additional Tokens
          </h2>
          <p className="text-slate-600">
            Get more tokens to continue using Script Mentor's advanced features
          </p>
          {currentTier === 'pro' && (
            <div className="mt-2 flex items-center justify-center gap-2 text-purple-600">
              <Crown className="h-4 w-4" />
              <span className="text-sm font-medium">
                Pro member discount: 30% off all token packages
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tokenPackages.map((pkg) => {
          const tokens = getTokensFromPriceId(pkg.priceId);
          const finalPrice = getDiscountedPrice(pkg.price, currentTier);
          const isDiscounted = currentTier === 'pro';
          const isBestValue = pkg.id === bestValue.id;
          const isRecommended = pkg.id === recommendedPackage;
          const valuePerToken = getValuePerToken(finalPrice, tokens);

          return (
            <div
              key={pkg.id}
              className={`relative p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg hover:scale-105 ${
                isRecommended 
                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' 
                  : getPackageColor(pkg.name, false)
              }`}
            >
              {/* Badges */}
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 flex gap-2">
                {isRecommended && (
                  <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Recommended
                  </span>
                )}
                {isBestValue && !isRecommended && (
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Best Value
                  </span>
                )}
                {pkg.popular && !isRecommended && !isBestValue && (
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Popular
                  </span>
                )}
              </div>

              {/* Header */}
              <div className="text-center mb-4">
                <div className="flex justify-center mb-2">
                  {getPackageIcon(pkg.name)}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-1">
                  {pkg.name}
                </h3>
                <p className="text-sm text-slate-600">
                  {pkg.description}
                </p>
              </div>

              {/* Tokens */}
              <div className="text-center mb-4">
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  <span className="text-4xl font-bold text-purple-600">
                    {tokens}
                  </span>
                  <span className="text-lg text-slate-600">tokens</span>
                </div>
                <div className="text-xs text-slate-500">
                  ${valuePerToken} per token
                </div>
              </div>

              {/* Price */}
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-1">
                  {isDiscounted && (
                    <span className="text-lg text-slate-500 line-through">
                      ${pkg.price}
                    </span>
                  )}
                  <span className="text-2xl font-bold text-slate-800">
                    ${finalPrice}
                  </span>
                </div>
                {isDiscounted && (
                  <div className="flex items-center justify-center gap-1">
                    <Crown className="h-3 w-3 text-purple-600" />
                    <span className="text-xs text-purple-600 font-medium">
                      You save ${(pkg.price - finalPrice).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="space-y-2 mb-6">
                {pkg.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-slate-600">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Purchase Button */}
              <button
                onClick={() => handlePurchase(pkg.priceId, pkg.name)}
                disabled={loading === pkg.priceId}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  isRecommended
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md`}
              >
                {loading === pkg.priceId ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Purchase Now
                  </>
                )}
              </button>

              {/* Usage estimate */}
              <div className="mt-3 text-center">
                <div className="text-xs text-slate-500">
                  Enough for ~{Math.floor(tokens / 15)} blended feedback sessions
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800 mb-1">
              Token Purchase Information
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Purchased tokens never expire</li>
              <li>• Tokens are added instantly to your account</li>
              <li>• One-time purchases work alongside your subscription</li>
              <li>• All purchases are secure and processed by Stripe</li>
              {currentTier === 'pro' && (
                <li>• Pro members get 30% discount on all token packages</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};