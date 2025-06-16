// src/data/subscriptionTiers.ts
import { SubscriptionTier, TokenCost } from '../types/subscription';

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out ScriptMentor',
    price: 0,
    currency: 'usd',
    interval: 'month',
    tokens: 50,
    stripePriceId: '', // No Stripe price for free tier
    features: [
      '50 AI feedback tokens per month',
      'Single scene analysis',
      'Basic mentor feedback',
      'Script library storage',
      'Standard support'
    ]
  },
  {
    id: 'creator',
    name: 'Creator',
    description: 'For serious screenwriters',
    price: 1999, // $19.99
    currency: 'usd',
    interval: 'month',
    tokens: 500,
    stripePriceId: 'price_1RalzkEOpk1Bj1eeIqTOsYNq',
    popular: true,
    features: [
      '500 AI feedback tokens per month',
      'Chunked script analysis',
      'All mentor personalities',
      'Blended mentor feedback',
      'Writer suggestions',
      'Script comparison tools',
      'Priority support',
      'Export capabilities'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For production companies and serious writers',
    price: 4999, // $49.99
    currency: 'usd',
    interval: 'month',
    tokens: 1500,
    stripePriceId: 'price_1Ram1AEOpk1Bj1ee2sRTCp8b',
    features: [
      '1,500 AI feedback tokens per month',
      'Unlimited script storage',
      'Advanced analytics',
      'Custom mentor training',
      'Team collaboration',
      'API access',
      'White-label options',
      'Dedicated support'
    ]
  }
];

export const TOKEN_COSTS: TokenCost[] = [
  {
    action: 'single_scene_feedback',
    baseCost: 5,
    description: 'AI feedback for a single scene (structured + scratchpad)'
  },
  {
    action: 'chunked_script_analysis',
    baseCost: 10,
    perChunkCost: 3,
    description: 'AI analysis per script chunk (base + per chunk)'
  },
  {
    action: 'blended_mentor_feedback',
    baseCost: 8,
    perChunkCost: 2,
    description: 'Multi-mentor blended feedback (premium feature)'
  },
  {
    action: 'writer_suggestions',
    baseCost: 3,
    description: 'AI-powered rewrite suggestions'
  },
  {
    action: 'script_rewrite_evaluation',
    baseCost: 4,
    description: 'AI evaluation of script rewrites'
  },
  {
    action: 'character_analysis',
    baseCost: 2,
    description: 'Deep character development analysis'
  }
];

export const getSubscriptionTier = (tierId: string): SubscriptionTier | undefined => {
  return SUBSCRIPTION_TIERS.find(tier => tier.id === tierId);
};

export const getTokenCost = (action: string): TokenCost | undefined => {
  return TOKEN_COSTS.find(cost => cost.action === action);
};

export const calculateTokenCost = (action: string, options: {
  chunkCount?: number;
  contentLength?: number;
}): number => {
  const tokenCost = getTokenCost(action);
  if (!tokenCost) return 0;

  let totalCost = tokenCost.baseCost;

  if (tokenCost.perChunkCost && options.chunkCount) {
    totalCost += tokenCost.perChunkCost * options.chunkCount;
  }

  if (tokenCost.perCharacterCost && options.contentLength) {
    totalCost += Math.ceil((options.contentLength / 1000) * tokenCost.perCharacterCost);
  }

  return totalCost;
};