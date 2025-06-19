// src/utils/tokenValidationMiddleware.ts
import { tokenService } from '../services/tokenService';
import { TokenUsage, TokenValidationResult, UserTokens } from '../types';

export interface TokenValidationMiddlewareResult {
  canProceed: boolean;
  validation: TokenValidationResult;
  cost: number;
  errorMessage?: string;
  userTokens?: UserTokens;
}

export interface TokenUsageContext {
  userId: string;
  actionType: TokenUsage['action_type'];
  scriptId?: string;
  mentorId?: string;
  sceneId?: string;
  additionalContext?: Record<string, any>;
}

/**
 * Token Validation Middleware
 * Provides comprehensive token validation before AI operations
 */
export class TokenValidationMiddleware {
  
  /**
   * Validate tokens for a specific action
   */
  static async validateTokensForAction(
    context: TokenUsageContext
  ): Promise<TokenValidationMiddlewareResult> {
    try {
      const { userId, actionType } = context;
      
      // Get token cost for the action
      const cost = tokenService.getTokenCost(actionType);
      
      // Validate user has sufficient tokens
      const validation = await tokenService.validateTokenBalance(userId, cost);
      
      // Get full user token information
      const userTokens = await tokenService.getUserTokenBalance(userId);
      
      if (!validation.hasEnoughTokens) {
        const errorMessage = this.generateInsufficientTokensMessage(validation, actionType);
        
        return {
          canProceed: false,
          validation,
          cost,
          errorMessage,
          userTokens: userTokens || undefined
        };
      }
      
      return {
        canProceed: true,
        validation,
        cost,
        userTokens: userTokens || undefined
      };
      
    } catch (error) {
      console.error('Token validation middleware error:', error);
      
      return {
        canProceed: false,
        validation: {
          hasEnoughTokens: false,
          currentBalance: 0,
          requiredTokens: tokenService.getTokenCost(context.actionType),
          tier: 'free'
        },
        cost: tokenService.getTokenCost(context.actionType),
        errorMessage: 'Unable to validate tokens. Please try again.'
      };
    }
  }
  
  /**
   * Pre-flight check for multiple actions
   */
  static async validateMultipleActions(
    userId: string,
    actions: Array<{ actionType: TokenUsage['action_type']; quantity?: number }>
  ): Promise<{
    canProceedAll: boolean;
    totalCost: number;
    currentBalance: number;
    actionResults: Array<{
      actionType: TokenUsage['action_type'];
      cost: number;
      canAfford: boolean;
    }>;
    shortfall?: number;
  }> {
    try {
      // Calculate total cost
      const totalCost = actions.reduce((sum, action) => {
        const cost = tokenService.getTokenCost(action.actionType);
        return sum + (cost * (action.quantity || 1));
      }, 0);
      
      // Get user balance
      const userTokens = await tokenService.getUserTokenBalance(userId);
      const currentBalance = userTokens?.balance || 0;
      
      // Check if user can afford all actions
      const canProceedAll = currentBalance >= totalCost;
      const shortfall = canProceedAll ? undefined : totalCost - currentBalance;
      
      // Check each action individually
      const actionResults = actions.map(action => {
        const cost = tokenService.getTokenCost(action.actionType) * (action.quantity || 1);
        return {
          actionType: action.actionType,
          cost,
          canAfford: currentBalance >= cost
        };
      });
      
      return {
        canProceedAll,
        totalCost,
        currentBalance,
        actionResults,
        shortfall
      };
      
    } catch (error) {
      console.error('Multi-action validation error:', error);
      
      return {
        canProceedAll: false,
        totalCost: 0,
        currentBalance: 0,
        actionResults: actions.map(action => ({
          actionType: action.actionType,
          cost: tokenService.getTokenCost(action.actionType),
          canAfford: false
        }))
      };
    }
  }
  
  /**
   * Check if user's tier allows a specific action
   */
  static checkTierPermissions(
    userTier: UserTokens['tier'],
    actionType: TokenUsage['action_type']
  ): { allowed: boolean; reason?: string } {
    
    // Free tier restrictions
    if (userTier === 'free') {
      switch (actionType) {
        case 'blended_feedback':
          return {
            allowed: false,
            reason: 'Blended feedback requires Creator tier or higher'
          };
        case 'writer_agent':
          return {
            allowed: false,
            reason: 'Writer Agent requires Creator tier or higher'
          };
        case 'chunked_feedback':
          return {
            allowed: true // Free users can use chunked feedback but it costs more tokens
          };
        case 'single_feedback':
        case 'rewrite_suggestions':
          return { allowed: true };
        default:
          return { allowed: true };
      }
    }
    
    // Creator and Pro tiers have access to all features
    return { allowed: true };
  }
  
  /**
   * Get user-friendly error messages for insufficient tokens
   */
  private static generateInsufficientTokensMessage(
    validation: TokenValidationResult,
    actionType: TokenUsage['action_type']
  ): string {
    const { currentBalance, requiredTokens, shortfall, tier } = validation;
    
    const actionNames: Record<TokenUsage['action_type'], string> = {
      single_feedback: 'Single Mentor Feedback',
      blended_feedback: 'Blended Mentor Feedback',
      chunked_feedback: 'Chunked Script Analysis',
      rewrite_suggestions: 'Rewrite Suggestions',
      writer_agent: 'Writer Agent Analysis'
    };
    
    const actionName = actionNames[actionType] || actionType;
    
    if (shortfall === undefined) {
      return `Unable to process ${actionName}. Please try again.`;
    }
    
    let message = `Insufficient tokens for ${actionName}.\n`;
    message += `Required: ${requiredTokens} tokens\n`;
    message += `Current balance: ${currentBalance} tokens\n`;
    message += `Short by: ${shortfall} tokens\n\n`;
    
    // Add tier-specific suggestions
    switch (tier) {
      case 'free':
        message += 'Consider upgrading to Creator tier for 500 tokens monthly, or wait for your next monthly allowance.';
        break;
      case 'creator':
        message += 'Your monthly allowance will reset soon, or consider upgrading to Pro tier for more tokens.';
        break;
      case 'pro':
        message += 'Your monthly allowance will reset soon. Pro tier includes 1,500 tokens monthly.';
        break;
    }
    
    return message;
  }
  
  /**
   * Process token transaction with validation
   */
  static async processValidatedTransaction(
    context: TokenUsageContext
  ): Promise<{
    success: boolean;
    validation: TokenValidationResult;
    error?: string;
  }> {
    try {
      // First validate
      const validationResult = await this.validateTokensForAction(context);
      
      if (!validationResult.canProceed) {
        return {
          success: false,
          validation: validationResult.validation,
          error: validationResult.errorMessage
        };
      }
      
      // Check tier permissions
      const tierCheck = this.checkTierPermissions(
        validationResult.validation.tier,
        context.actionType
      );
      
      if (!tierCheck.allowed) {
        return {
          success: false,
          validation: validationResult.validation,
          error: tierCheck.reason
        };
      }
      
      // Process the transaction
      const transactionResult = await tokenService.processTokenTransaction(
        context.userId,
        context.actionType,
        context.scriptId,
        context.mentorId,
        context.sceneId
      );
      
      return {
        success: transactionResult.success,
        validation: transactionResult.validation,
        error: transactionResult.success ? undefined : 'Token deduction failed'
      };
      
    } catch (error) {
      console.error('Error processing validated transaction:', error);
      
      return {
        success: false,
        validation: {
          hasEnoughTokens: false,
          currentBalance: 0,
          requiredTokens: tokenService.getTokenCost(context.actionType),
          tier: 'free'
        },
        error: 'Transaction processing failed'
      };
    }
  }
}

/**
 * Utility functions for token operations
 */
export class TokenUtils {
  
  /**
   * Format token count for display
   */
  static formatTokenCount(count: number): string {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  }
  
  /**
   * Calculate estimated operations possible with current balance
   */
  static estimateOperations(
    currentBalance: number,
    actionType: TokenUsage['action_type']
  ): number {
    const cost = tokenService.getTokenCost(actionType);
    return Math.floor(currentBalance / cost);
  }
  
  /**
   * Get token cost display information
   */
  static getTokenCostInfo(actionType: TokenUsage['action_type']): {
    cost: number;
    description: string;
    estimatedTime: string;
  } {
    const cost = tokenService.getTokenCost(actionType);
    
    const descriptions: Record<TokenUsage['action_type'], string> = {
      single_feedback: 'Detailed feedback from one mentor',
      blended_feedback: 'Combined insights from multiple mentors',
      chunked_feedback: 'Complete script analysis by chunks',
      rewrite_suggestions: 'Specific rewrite recommendations',
      writer_agent: 'AI writing assistant analysis'
    };
    
    const times: Record<TokenUsage['action_type'], string> = {
      single_feedback: '30-60 seconds',
      blended_feedback: '60-90 seconds',
      chunked_feedback: '3-10 minutes',
      rewrite_suggestions: '45-75 seconds',
      writer_agent: '30-45 seconds'
    };
    
    return {
      cost,
      description: descriptions[actionType] || actionType,
      estimatedTime: times[actionType] || '30-60 seconds'
    };
  }
  
  /**
   * Get tier upgrade benefits
   */
  static getTierUpgradeBenefits(currentTier: UserTokens['tier']): {
    nextTier?: UserTokens['tier'];
    benefits: string[];
    tokenIncrease?: number;
  } {
    switch (currentTier) {
      case 'free':
        return {
          nextTier: 'creator',
          tokenIncrease: 450, // 500 - 50
          benefits: [
            '10x more tokens (500 vs 50)',
            'Access to blended feedback',
            'Writer Agent analysis',
            'All mentor personalities',
            'Priority support'
          ]
        };
      case 'creator':
        return {
          nextTier: 'pro',
          tokenIncrease: 1000, // 1500 - 500
          benefits: [
            '3x more tokens (1,500 vs 500)',
            '30% discount on token purchases',
            'Unlimited script uploads',
            'Advanced analytics',
            'Premium support',
            'Early access to new features'
          ]
        };
      case 'pro':
        return {
          benefits: [
            'You have the highest tier!',
            'Maximum tokens (1,500 monthly)',
            'All features unlocked',
            'Premium support'
          ]
        };
    }
  }
  
  /**
   * Check if action is cost-effective for user's tier
   */
  static isCostEffective(
    actionType: TokenUsage['action_type'],
    userTier: UserTokens['tier'],
    currentBalance: number
  ): {
    isCostEffective: boolean;
    percentageOfAllowance: number;
    recommendation?: string;
  } {
    const cost = tokenService.getTokenCost(actionType);
    const tierAllowances = { free: 50, creator: 500, pro: 1500 };
    const allowance = tierAllowances[userTier];
    const percentageOfAllowance = (cost / allowance) * 100;
    
    let isCostEffective = true;
    let recommendation: string | undefined;
    
    // High-cost actions for low-tier users
    if (userTier === 'free' && actionType === 'chunked_feedback') {
      isCostEffective = false;
      recommendation = 'Chunked feedback uses 50% of your monthly allowance. Consider upgrading to Creator tier.';
    } else if (userTier === 'free' && actionType === 'blended_feedback') {
      isCostEffective = false;
      recommendation = 'Blended feedback uses 30% of your monthly allowance. Consider upgrading to Creator tier.';
    } else if (percentageOfAllowance > 20) {
      recommendation = `This action uses ${percentageOfAllowance.toFixed(1)}% of your monthly allowance.`;
    }
    
    return {
      isCostEffective,
      percentageOfAllowance,
      recommendation
    };
  }
}

// Export utility functions as well
export { tokenService } from '../services/tokenService';