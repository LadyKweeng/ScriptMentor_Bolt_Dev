import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { stripeService } from '../services/stripeService';
import { products } from '../stripe-config';
import { 
  Zap, 
  Crown, 
  Star, 
  ArrowRight, 
  X, 
  AlertTriangle, 
  TrendingUp,
  Clock,
  Shield,
  Sparkles
} from 'lucide-react';

export interface UpgradePromptProps {
  trigger: 'low_tokens' | 'insufficient_tokens' | 'premium_feature' | 'usage_exceeded';
  requiredTokens?: number;
  featureName?: string;
  onClose?: () => void;
  className?: string;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ 
  trigger, 
  requiredTokens, 
  featureName, 
  onClose,
  className = ''
}) => {
  // Replace useTokens hook with manual session management
  const [session, setSession] = useState<any>(null);
  const [userTokens, setUserTokens] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Get session manually instead of using useTokens hook
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      // You can add token fetching logic here if needed
      // For now, we'll use placeholder data
      if (session?.user) {
        setUserTokens({
          balance: 5, // placeholder
          tier: 'free', // placeholder
          monthly_allowance: 50 // placeholder
        });
      }
    };
    getSession();
  }, []);

  const handleUpgrade = async (priceId: string) => {
    if (!session?.user) {
      alert('Please sign in to upgrade your plan');
      return;
    }

    try {
      setLoading(priceId);
      await stripeService.redirectToCheckout({
        priceId,
        mode: 'subscription',
        successUrl: `${window.location.origin}/success?upgrade=true`,
        cancelUrl: window.location.href
      });
    } catch (error) {
      console.error('Failed to start upgrade:', error);
      alert('Failed to start upgrade process. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  // Get relevant products based on current tier
  const getRecommendedPlans = () => {
    const currentTier = userTokens?.tier || 'free';
    
    switch (currentTier) {
      case 'free':
        return products.filter(p => p.name === 'Creator' || p.name === 'Pro');
      case 'creator':
        return products.filter(p => p.name === 'Pro');
      default:
        return products.filter(p => p.name !== 'Free Tier');
    }
  };

  const getPromptContent = () => {
    switch (trigger) {
      case 'low_tokens':
        return {
          icon: <AlertTriangle className="h-6 w-6 text-yellow-400" />,
          title: 'Running Low on Tokens',
          description: `You have ${userTokens?.balance || 0} tokens remaining. Consider upgrading to avoid interruptions in your workflow.`,
          urgency: 'medium'
        };
      
      case 'insufficient_tokens':
        return {
          icon: <Zap className="h-6 w-6 text-red-400" />,
          title: 'Not Enough Tokens',
          description: `You need ${requiredTokens} tokens for this action, but only have ${userTokens?.balance || 0}. Upgrade now to continue.`,
          urgency: 'high'
        };
      
      case 'premium_feature':
        return {
          icon: <Crown className="h-6 w-6 text-yellow-400" />,
          title: 'Premium Feature',
          description: `${featureName} is available with Creator or Pro plans. Unlock advanced features and get more tokens.`,
          urgency: 'medium'
        };
      
      case 'usage_exceeded':
        return {
          icon: <TrendingUp className="h-6 w-6 text-blue-400" />,
          title: 'High Usage Detected',
          description: 'Your usage pattern suggests you could benefit from a higher tier with more tokens and features.',
          urgency: 'low'
        };
      
      default:
        return {
          icon: <Sparkles className="h-6 w-6 text-blue-400" />,
          title: 'Upgrade Your Experience',
          description: 'Get more tokens and unlock premium features to supercharge your screenplay development.',
          urgency: 'low'
        };
    }
  };

  const promptContent = getPromptContent();
  const recommendedPlans = getRecommendedPlans();

  const getUrgencyStyles = () => {
    switch (promptContent.urgency) {
      case 'high':
        return 'border-red-500/50 bg-red-900/20';
      case 'medium':
        return 'border-yellow-500/50 bg-yellow-900/20';
      default:
        return 'border-blue-500/50 bg-blue-900/20';
    }
  };

  const getTierIcon = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'creator':
        return <Zap className="h-5 w-5 text-blue-400" />;
      case 'pro':
        return <Crown className="h-5 w-5 text-yellow-400" />;
      default:
        return <Shield className="h-5 w-5 text-slate-400" />;
    }
  };

  return (
    <div className={`bg-slate-800/95 backdrop-blur-sm rounded-xl border p-6 ${getUrgencyStyles()} ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {promptContent.icon}
          <div>
            <h3 className="text-lg font-semibold text-white">{promptContent.title}</h3>
            <p className="text-sm text-slate-300 mt-1">{promptContent.description}</p>
          </div>
        </div>
        
        {onClose && (
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Current Status */}
      {userTokens && (
        <div className="mb-6 p-4 bg-slate-700/50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">Current Plan</span>
            <span className="text-white font-medium capitalize">{userTokens.tier}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-300">Token Balance</span>
            <span className="text-white font-medium">{userTokens.balance} tokens</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-300">Monthly Allowance</span>
            <span className="text-white font-medium">{userTokens.monthly_allowance} tokens</span>
          </div>
        </div>
      )}

      {/* Recommended Plans */}
      <div className="space-y-3 mb-6">
        <h4 className="text-sm font-medium text-slate-300">Recommended Upgrades</h4>
        
        {recommendedPlans.map((plan) => (
          <div key={plan.id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getTierIcon(plan.name)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{plan.name}</span>
                    {plan.popular && (
                      <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-1 rounded-full flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{plan.features[0]}</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-lg font-bold text-white">
                  ${plan.price}{plan.price > 0 && <span className="text-sm text-slate-400">/mo</span>}
                </div>
              </div>
            </div>
            
            {/* Key Benefits */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {plan.features.slice(0, 4).map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
            
            {/* CTA Button */}
            <button
              onClick={() => handleUpgrade(plan.priceId)}
              disabled={loading === plan.priceId}
              className={`w-full mt-4 py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                plan.popular
                  ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-slate-900 hover:from-yellow-300 hover:to-orange-300'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500'
              } disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95`}
            >
              {loading === plan.priceId ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Upgrade to {plan.name}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Additional Benefits */}
      <div className="border-t border-slate-600 pt-4">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Why Upgrade?</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Zap className="h-4 w-4 text-blue-400 flex-shrink-0" />
            <span>More tokens for unlimited creativity</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Crown className="h-4 w-4 text-yellow-400 flex-shrink-0" />
            <span>Access to premium features</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="h-4 w-4 text-green-400 flex-shrink-0" />
            <span>Priority support & processing</span>
          </div>
        </div>
      </div>

      {/* Money-back guarantee */}
      <div className="mt-4 text-center">
        <p className="text-xs text-slate-400">
          ✓ 30-day money-back guarantee • Cancel anytime • Instant access
        </p>
      </div>
    </div>
  );
};

// Convenience wrapper components for common use cases
export const LowTokensPrompt: React.FC<{ onClose?: () => void }> = ({ onClose }) => (
  <UpgradePrompt trigger="low_tokens" onClose={onClose} />
);

export const InsufficientTokensPrompt: React.FC<{ 
  requiredTokens: number; 
  onClose?: () => void;
}> = ({ requiredTokens, onClose }) => (
  <UpgradePrompt 
    trigger="insufficient_tokens" 
    requiredTokens={requiredTokens} 
    onClose={onClose} 
  />
);

export const PremiumFeaturePrompt: React.FC<{ 
  featureName: string; 
  onClose?: () => void;
}> = ({ featureName, onClose }) => (
  <UpgradePrompt 
    trigger="premium_feature" 
    featureName={featureName} 
    onClose={onClose} 
  />
);

export const UsageExceededPrompt: React.FC<{ onClose?: () => void }> = ({ onClose }) => (
  <UpgradePrompt trigger="usage_exceeded" onClose={onClose} />
);

export default UpgradePrompt;