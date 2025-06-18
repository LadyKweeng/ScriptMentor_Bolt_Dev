// src/types/tokens.ts
// Token System Type Definitions for Script Mentor

export interface UserTokens {
  user_id: string;
  balance: number;
  monthly_allowance: number;
  tier: 'free' | 'creator' | 'pro';
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface TokenUsage {
  id: string;
  user_id: string;
  tokens_used: number;
  action_type: 'single_feedback' | 'blended_feedback' | 'chunked_feedback' | 'rewrite_suggestions' | 'writer_agent';
  script_id?: string;
  mentor_id?: string;
  scene_id?: string;
  created_at: string;
}

export interface TokenTransaction {
  id: string;
  user_id: string;
  tokens_added: number;
  transaction_type: 'subscription_grant' | 'monthly_reset' | 'one_time_purchase' | 'bonus_grant' | 'admin_adjustment';
  stripe_payment_id?: string;
  stripe_subscription_id?: string;
  description?: string;
  created_at: string;
}

export interface TokenCosts {
  single_feedback: number;
  blended_feedback: number;
  chunked_feedback: number;
  rewrite_suggestions: number;
  writer_agent: number;
}

export interface TierLimits {
  free: {
    tokens: number;
    features: string[];
    restrictions: string[];
  };
  creator: {
    tokens: number;
    features: string[];
    restrictions: string[];
  };
  pro: {
    tokens: number;
    features: string[];
    restrictions: string[];
  };
}

export interface TokenDeductionRequest {
  userId: string;
  tokensToDeduct: number;
  actionType: TokenUsage['action_type'];
  scriptId?: string;
  mentorId?: string;
  sceneId?: string;
}

export interface TokenAllocationRequest {
  userId: string;
  tokensToAdd: number;
  transactionType: TokenTransaction['transaction_type'];
  stripePaymentId?: string;
  stripeSubscriptionId?: string;
  description?: string;
}

export interface TokenValidationResult {
  hasEnoughTokens: boolean;
  currentBalance: number;
  requiredTokens: number;
  shortfall?: number;
  tier: UserTokens['tier'];
}

export interface TokenUsageStats {
  totalUsed: number;
  usageByAction: Record<TokenUsage['action_type'], number>;
  usageThisMonth: number;
  averageDaily: number;
  daysUntilReset: number;
}

// Constants that should match the database and webhook
export const TOKEN_COSTS: TokenCosts = {
  single_feedback: 5,
  blended_feedback: 15,
  chunked_feedback: 25,
  rewrite_suggestions: 10,
  writer_agent: 8,
} as const;

export const TIER_LIMITS: TierLimits = {
  free: {
    tokens: 50,
    features: [
      'Single mentor feedback',
      'Basic script analysis',
      'Community support'
    ],
    restrictions: [
      'No blended feedback',
      'No writer agent',
      'Limited to basic mentors only'
    ]
  },
  creator: {
    tokens: 500,
    features: [
      'All mentor personalities',
      'Blended feedback mode', 
      'Writer Agent analysis',
      'Advanced script insights',
      'Priority support'
    ],
    restrictions: []
  },
  pro: {
    tokens: 1500,
    features: [
      'Everything from Creator tier',
      '30% token discount on purchases',
      'Unlimited script uploads',
      'Advanced analytics',
      'Premium support',
      'Early access to new features'
    ],
    restrictions: []
  }
} as const;

export const PRICE_ID_TO_TIER: Record<string, UserTokens['tier']> = {
  'price_1Raly0EOpk1Bj1eeuMuWMJ7Y': 'free',
  'price_1RalzkEOpk1Bj1eeIqTOsYNq': 'creator', 
  'price_1Ram1AEOpk1Bj1ee2sRTCp8b': 'pro',
} as const;

// Helper type guards
export function isValidTier(tier: string): tier is UserTokens['tier'] {
  return ['free', 'creator', 'pro'].includes(tier);
}

export function isValidActionType(action: string): action is TokenUsage['action_type'] {
  return [
    'single_feedback',
    'blended_feedback', 
    'chunked_feedback',
    'rewrite_suggestions',
    'writer_agent'
  ].includes(action);
}

export function isValidTransactionType(type: string): type is TokenTransaction['transaction_type'] {
  return [
    'subscription_grant',
    'monthly_reset',
    'one_time_purchase', 
    'bonus_grant',
    'admin_adjustment'
  ].includes(type);
}

// Helper functions for token calculations
export function calculateTokenCost(actionType: TokenUsage['action_type'], tier: UserTokens['tier'] = 'free'): number {
  const baseCost = TOKEN_COSTS[actionType];
  
  // Pro tier gets 30% discount on token purchases (not subscription tokens)
  if (tier === 'pro') {
    return Math.ceil(baseCost * 0.7);
  }
  
  return baseCost;
}

export function getDaysUntilReset(lastResetDate: string): number {
  const resetDate = new Date(lastResetDate);
  const nextReset = new Date(resetDate);
  nextReset.setMonth(nextReset.getMonth() + 1);
  
  const now = new Date();
  const diffTime = nextReset.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

export function getUsagePercentage(used: number, allowance: number): number {
  if (allowance === 0) return 0;
  return Math.min(100, (used / allowance) * 100);
}

export function getUsageColor(percentage: number): 'green' | 'yellow' | 'red' {
  if (percentage >= 80) return 'red';
  if (percentage >= 60) return 'yellow';
  return 'green';
}