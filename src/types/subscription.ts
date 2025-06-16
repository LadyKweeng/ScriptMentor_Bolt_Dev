// src/types/subscription.ts
export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price: number; // in cents
  currency: string;
  interval: 'month' | 'year';
  tokens: number;
  features: string[];
  popular?: boolean;
  stripePriceId: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  tierId: string;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
}

export interface TokenUsage {
  id: string;
  userId: string;
  action: 'feedback_generation' | 'script_analysis' | 'rewrite_suggestion' | 'chunked_analysis';
  tokensUsed: number;
  timestamp: Date;
  scriptId?: string;
  mentorId?: string;
  details?: {
    feedbackType?: 'structured' | 'scratchpad' | 'blended';
    chunkCount?: number;
    contentLength?: number;
  };
}

export interface UserTokenBalance {
  userId: string;
  totalTokens: number;
  usedTokens: number;
  remainingTokens: number;
  resetDate: Date;
  subscriptionTier: string;
}

export interface TokenCost {
  action: string;
  baseCost: number;
  perChunkCost?: number;
  perCharacterCost?: number;
  description: string;
}