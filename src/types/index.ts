// src/types/index.ts - Updated with token integration
export interface Mentor {
  id: string;
  name: string;
  tone: string;
  styleNotes: string;
  avatar: string;
  accent: string;
  mantra: string;
  feedbackStyle: 'direct' | 'contemplative' | 'analytical' | 'pragmatic' | 'strategic';
  priorities: string[];
  analysisApproach: string;
  // NEW: Enhanced mentor properties
  specificTechniques?: string[];
  voicePattern?: string;
}

export interface ScriptScene {
  id: string;
  title: string;
  content: string;
  characters: string[];
  location?: string;
  time?: string;
}

export interface Character {
  name: string;
  notes: string[];
}

// Enhanced Feedback interface to store both types
export interface Feedback {
  id: string;
  mentorId: string;
  sceneId: string;
  structuredContent: string;  // Structured feedback content
  scratchpadContent: string;  // Scratchpad feedback content
  timestamp: Date;
  categories: {
    structure: string;
    dialogue: string;
    pacing: string;
    theme: string;
  };
  // Keep legacy content field for backward compatibility
  content?: string;
  // NEW: Support for chunked feedback
  isChunked?: boolean;
  chunkedFeedback?: ChunkedScriptFeedback;
}

export interface ScriptRewrite {
  id: string;
  originalSceneId: string;
  content: string;
  feedbackApplied: string[];
  timestamp: Date;
}

export interface Session {
  id: string;
  name: string;
  scenes: ScriptScene[];
  feedback: Feedback[];
  characters: Record<string, Character>;
  rewrites: ScriptRewrite[];
  lastUpdated: Date;
}

export type FeedbackMode = 'structured' | 'scratchpad';
export type MentorWeights = Record<string, number>;

// NEW: Writer Agent Types
export interface WriterSuggestion {
  note: string;
  suggestion: string;
}

export interface WriterSuggestionsResponse {
  suggestions: WriterSuggestion[];
  success: boolean;
  mentor_id: string;
  timestamp: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

export interface WriterSuggestionsRequest {
  feedback_text: string;
  mentor_id: string;
}

// Legacy rewrite suggestions types (for backward compatibility)
export interface RewriteSuggestion {
  category: 'dialogue' | 'action' | 'structure' | 'character' | 'pacing' | 'visual';
  title: string;
  issue: string;
  originalExample: string;
  rewriteExample: string;
  explanation: string;
  mentorReasoning: string;
  lineReference?: string;
  difficulty: 'easy' | 'medium' | 'advanced';
}

export interface RewriteSuggestionsResponse {
  suggestions: RewriteSuggestion[];
  mentorSummary: string;
  overallApproach: string;
}

export interface RewriteSuggestionsApiResponse {
  success: boolean;
  suggestions: RewriteSuggestion[];
  mentorSummary: string;
  overallApproach: string;
  mentor_id: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  timestamp: string;
  error?: string;
}

// NEW: Chunked script support
export interface ScriptChunk {
  id: string;
  title: string; // "Pages 1-15" or "Act I" or "Sequence 1"
  content: string;
  characters: string[];
  startPage?: number;
  endPage?: number;
  chunkType: 'pages' | 'act' | 'sequence';
  chunkIndex: number;
}

export interface ChunkFeedback {
  chunkId: string;
  chunkTitle: string;
  structuredContent: string;
  scratchpadContent: string;
  mentorId: string;
  timestamp: Date;
  categories: {
    structure: string;
    dialogue: string;
    pacing: string;
    theme: string;
  };
}

// NEW: Container for all chunk feedback
export interface ChunkedScriptFeedback {
  id: string;
  scriptId: string;
  mentorId: string;
  chunks: ChunkFeedback[];
  summary?: {
    overallStructure: string;
    keyStrengths: string[];
    majorIssues: string[];
    globalRecommendations: string[];
  };
  timestamp: Date;
}

// NEW: Support for chunked script metadata
export interface FullScript {
  id: string;
  title: string;
  originalContent: string;
  processedContent: string;
  chunks: ScriptChunk[];
  characters: Record<string, Character>;
  totalPages: number;
  chunkingStrategy: 'pages' | 'acts' | 'sequences';
  lastAnalyzed?: Date;
}

// ===== TOKEN SYSTEM TYPES =====

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

// Helper functions for token costs
export function getTokenCostForAction(actionType: TokenUsage['action_type']): number {
  return TOKEN_COSTS[actionType];
}

export function getTierAllowance(tier: UserTokens['tier']): number {
  return TIER_LIMITS[tier].tokens;
}

// NEW: Advanced analytics and status interfaces
export interface UserAnalytics {
  currentMonth: {
    used: number;
    remaining: number;
    percentage: number;
    tier: UserTokens['tier'];
  };
  recentUsage: Array<{
    date: string;
    tokensUsed: number;
    actionType: TokenUsage['action_type'];
  }>;
  projectedUsage: {
    endOfMonth: number;
    willExceedLimit: boolean;
    recommendedTier?: UserTokens['tier'];
  };
  efficiency: {
    tokensPerAction: Record<TokenUsage['action_type'], number>;
    mostUsedAction: TokenUsage['action_type'];
    recommendations: string[];
  };
}

export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  tier: UserTokens['tier'];
  billingCycle: string;
  nextBillingDate?: string;
  canceledAt?: string;
  features: {
    blendedFeedback: boolean;
    writerAgent: boolean;
    chunkedFeedback: boolean;
    premiumMentors: boolean;
    prioritySupport: boolean;
  };
}

export interface BatchValidationResult {
  canAffordAll: boolean;
  totalCost: number;
  currentBalance: number;
  insufficientActions: Array<{
    actionType: TokenUsage['action_type'];
    required: number;
    shortfall: number;
  }>;
}

// Real-time subscription types
export type TokenUpdateCallback = (tokens: UserTokens) => void;
export type UnsubscribeFunction = () => void;

// NEW: Token-aware service interfaces
export interface TokenAwareRequest {
  userId: string;
  actionType: TokenUsage['action_type'];
  scriptId?: string;
  mentorId?: string;
  sceneId?: string;
}

export interface TokenAwareResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  tokenInfo: {
    tokensUsed: number;
    remainingBalance: number;
    action: TokenUsage['action_type'];
  };
}