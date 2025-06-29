// src/components/LowBalanceWarning.tsx
import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  X, 
  Zap,
  ShoppingCart,
  Crown,
  BarChart3
} from 'lucide-react';
import { tokenPackages, getTokensFromPriceId, getDiscountedPrice } from '../stripe-config';
import { stripeService } from '../services/stripeService';
import { supabase } from '../utils/supabaseClient';

interface LowBalanceWarningProps {
  userId: string;
  currentBalance: number;
  currentTier: 'free' | 'creator' | 'pro';
  monthlyAllowance: number;
  usageThisMonth: number;
  daysUntilReset: number;
  onDismiss?: () => void;
  onTopUpClick?: () => void;
  severity: 'low' | 'critical' | 'exhausted';
  className?: string;
}

export const LowBalanceWarning: React.FC<LowBalanceWarningProps> = ({
  userId,
  currentBalance,
  currentTier,
  monthlyAllowance,
  usageThisMonth,
  daysUntilReset,
  onDismiss,
  onTopUpClick,
  severity,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, []);

  if (isDismissed) return null;

  const getWarningConfig = () => {
    switch (severity) {
      case 'exhausted':
        return {
          icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
          bgColor: 'bg-red-50 border-red-200',
          textColor: 'text-red-800',
          title: 'No Tokens Remaining',
          description: 'You\'ve used all your tokens',
          actionText: 'Get Tokens Now',
          actionColor: 'bg-red-600 hover:bg-red-700',
          urgency: 'high'
        };
      case 'critical':
        return {
          icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
          bgColor: 'bg-orange-50 border-orange-200',
          textColor: 'text-orange-800',
          title: 'Very Low Tokens',
          description: `Only ${currentBalance} tokens left`,
          actionText: 'Top Up Now',
          actionColor: 'bg-orange-600 hover:bg-orange-700',
          urgency: 'medium'
        };
      case 'low':
        return {
          icon: <Clock className="h-5 w-5 text-yellow-500" />,
          bgColor: 'bg-yellow-50 border-yellow-200',
          textColor: 'text-yellow-800',
          title: 'Running Low on Tokens',
          description: `${currentBalance} tokens remaining`,
          actionText: 'Top Up',
          actionColor: 'bg-yellow-600 hover:bg-yellow-700',
          urgency: 'low'
        };
      default:
        return {
          icon: <AlertTriangle className="h-5 w-5 text-blue-500" />,
          bgColor: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-800',
          title: 'Token Notice',
          description: 'Check your token balance',
          actionText: 'View Details',
          actionColor: 'bg-blue-600 hover:bg-blue-700',
          urgency: 'low'
        };
    }
  };

  const handleQuickPurchase = async (priceId: string, packageName: string) => {
    if (!session?.user) {
      alert('Please sign in to purchase tokens');
      return;
    }

    try {
      setLoading(priceId);
      await stripeService.redirectToCheckout({
        priceId,
        mode: 'payment',
        successUrl: `${window.location.origin}/success?purchase=quick&package=${packageName}`,
        cancelUrl: window.location.href
      });
    } catch (error) {
      console.error('Failed to start quick purchase:', error);
      alert('Failed to start purchase. Please try again.');
      setLoading(null);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const config = getWarningConfig();

  // Calculate usage stats
  const usagePercentage = monthlyAllowance > 0 ? Math.round((usageThisMonth / monthlyAllowance) * 100) : 0;
  const dailyUsage = daysUntilReset > 0 ? Math.round(usageThisMonth / (30 - daysUntilReset)) : 0;
  const projectedUsage = dailyUsage * 30;

  // Get quick purchase options
  const getQuickOptions = () => {
    if (severity === 'exhausted') {
      return tokenPackages.slice(0, 2); // Show first two options for immediate relief
    }
    return [tokenPackages.find(pkg => pkg.name === 'Starter Pack')].filter(Boolean);
  };

  const quickOptions = getQuickOptions();

  return (
    <div className={`border rounded-lg transition-all duration-200 ${config.bgColor} ${className}`}>
      {/* Main Warning Bar */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.icon}
            <div>
              <h4 className={`font-semibold ${config.textColor}`}>
                {config.title}
              </h4>
              <p className={`text-sm ${config.textColor} opacity-80`}>
                {config.description} • {daysUntilReset} days until reset
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick action buttons */}
            {severity === 'exhausted' && (
              <button
                onClick={() => onTopUpClick?.()}
                className={`px-3 py-1.5 text-white text-sm font-medium rounded-md transition-colors duration-200 ${config.actionColor}`}
              >
                {config.actionText}
              </button>
            )}

            {severity !== 'exhausted' && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`px-3 py-1.5 text-white text-sm font-medium rounded-md transition-colors duration-200 ${config.actionColor}`}
              >
                {isExpanded ? 'Hide Options' : config.actionText}
              </button>
            )}

            <button
              onClick={handleDismiss}
              className={`p-1 rounded-md hover:bg-opacity-20 hover:bg-black transition-colors duration-200 ${config.textColor}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Usage Progress Bar */}
        {severity !== 'exhausted' && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className={`${config.textColor} opacity-70`}>
                Monthly usage
              </span>
              <span className={`${config.textColor} font-medium`}>
                {usageThisMonth} / {monthlyAllowance} tokens ({usagePercentage}%)
              </span>
            </div>
            <div className="w-full bg-white bg-opacity-50 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  usagePercentage > 90 ? 'bg-red-500' :
                  usagePercentage > 75 ? 'bg-orange-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && severity !== 'exhausted' && (
        <div className="border-t border-opacity-30 p-4 space-y-4">
          {/* Usage Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <div className={`text-lg font-bold ${config.textColor}`}>
                {currentBalance}
              </div>
              <div className={`text-xs ${config.textColor} opacity-70`}>
                Tokens Left
              </div>
            </div>
            <div>
              <div className={`text-lg font-bold ${config.textColor}`}>
                {dailyUsage}
              </div>
              <div className={`text-xs ${config.textColor} opacity-70`}>
                Daily Average
              </div>
            </div>
            <div>
              <div className={`text-lg font-bold ${config.textColor}`}>
                {daysUntilReset}
              </div>
              <div className={`text-xs ${config.textColor} opacity-70`}>
                Days Until Reset
              </div>
            </div>
          </div>

          {/* Projection Warning */}
          {projectedUsage > monthlyAllowance && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">
                  Usage Projection Warning
                </span>
              </div>
              <p className="text-sm text-red-700 mt-1">
                At your current rate ({dailyUsage} tokens/day), you'll use ~{projectedUsage} tokens this month, 
                exceeding your {monthlyAllowance} token allowance.
              </p>
            </div>
          )}

          {/* Quick Purchase Options */}
          {quickOptions.length > 0 && (
            <div>
              <h5 className={`font-medium ${config.textColor} mb-2`}>
                Quick Top-Up Options
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickOptions.map((pkg) => {
                  if (!pkg) return null;
                  const tokens = getTokensFromPriceId(pkg.priceId);
                  const finalPrice = getDiscountedPrice(pkg.price, currentTier);
                  const isDiscounted = currentTier === 'pro';

                  return (
                    <button
                      key={pkg.id}
                      onClick={() => handleQuickPurchase(pkg.priceId, pkg.name)}
                      disabled={loading === pkg.priceId}
                      className="p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all duration-200 text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-800">{pkg.name}</span>
                        {isDiscounted && (
                          <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-xs">
                            30% OFF
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {tokens} tokens
                        </span>
                        <div className="flex items-center gap-1">
                          {isDiscounted && (
                            <span className="text-xs text-gray-500 line-through">
                              ${pkg.price}
                            </span>
                          )}
                          <span className="font-semibold text-gray-800">
                            ${finalPrice}
                          </span>
                        </div>
                      </div>
                      {loading === pkg.priceId && (
                        <div className="text-xs text-gray-500 mt-1">
                          Processing...
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alternative Actions */}
          <div className="flex flex-col sm:flex-row gap-2 justify-between items-center pt-2 border-t border-opacity-30">
            <div className="text-xs text-gray-600">
              {currentTier === 'free' 
                ? 'Consider upgrading to Creator or Pro for more monthly tokens'
                : 'Your monthly tokens will reset automatically'
              }
            </div>
            
            <div className="flex gap-2">
              {currentTier === 'free' && (
                <button
                  onClick={() => {
                    console.log('Navigate to subscription upgrade');
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors duration-200 flex items-center gap-1"
                >
                  <Crown className="h-3 w-3" />
                  Upgrade Plan
                </button>
              )}
              
              <button
                onClick={() => onTopUpClick?.()}
                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded-md transition-colors duration-200 flex items-center gap-1"
              >
                <ShoppingCart className="h-3 w-3" />
                View All Packages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};