// src/services/rewriteEvaluationService.ts - Complete enhanced version with token integration + ALL original features
import { ScriptScene, Feedback, ScriptRewrite, TokenAwareRequest, TokenAwareResponse } from '../types';
import { tokenService } from './tokenService';

// PRESERVED: Original interfaces
interface RewriteAnalysis {
  improvements: string[];
  regressions: string[];
  overallScore: number;
  summary: string;
}

// NEW: Token-aware interfaces
interface RewriteEvaluationRequest extends TokenAwareRequest {
  originalScene: ScriptScene;
  rewrittenScene: ScriptRewrite;
  feedback: Feedback;
}

interface RewriteEvaluationResponse extends TokenAwareResponse<RewriteAnalysis> {
  analysis: RewriteAnalysis;
}

class RewriteEvaluationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'https://smbackend-production.up.railway.app/api';
  }

  /**
   * NEW: Token-aware rewrite evaluation
   * PRESERVED: All original GPT-4o evaluation functionality
   */
  async evaluateRewrite(request: RewriteEvaluationRequest): Promise<RewriteEvaluationResponse> {
    const { 
      userId, 
      originalScene, 
      rewrittenScene, 
      feedback, 
      actionType = 'rewrite_suggestions',
      scriptId,
      mentorId,
      sceneId 
    } = request;

    console.log('📊 Evaluating rewrite with GPT-4o and token validation...', {
      userId,
      originalId: originalScene.id,
      rewriteId: rewrittenScene.id,
      feedbackId: feedback.id,
      actionType
    });

    try {
      // NEW: Step 1 - Token validation and deduction
      const tokenResult = await tokenService.processTokenTransaction(
        userId,
        actionType,
        scriptId || originalScene.id,
        mentorId || feedback.mentorId,
        sceneId || originalScene.id
      );

      if (!tokenResult.success) {
        const errorMessage = tokenResult.validation.hasEnoughTokens 
          ? 'Token deduction failed due to system error'
          : `Insufficient tokens for rewrite evaluation. Need ${tokenResult.validation.requiredTokens}, have ${tokenResult.validation.currentBalance}`;
        
        return {
          success: false,
          error: errorMessage,
          analysis: this.createEmptyAnalysis(),
          tokenInfo: {
            tokensUsed: 0,
            remainingBalance: tokenResult.validation.currentBalance,
            action: actionType
          }
        };
      }

      // PRESERVED: Step 2 - Original GPT-4o rewrite evaluation logic
      const analysisResult = await this.performOriginalRewriteEvaluation(originalScene, rewrittenScene, feedback);
      
      return {
        success: true,
        analysis: analysisResult,
        data: analysisResult,
        tokenInfo: {
          tokensUsed: tokenService.getTokenCost(actionType),
          remainingBalance: tokenResult.validation.currentBalance,
          action: actionType
        }
      };

    } catch (error: any) {
      console.error('❌ Rewrite evaluation failed:', error);
      
      return {
        success: false,
        error: `Rewrite evaluation failed: ${error.message}`,
        analysis: this.createEmptyAnalysis(),
        tokenInfo: {
          tokensUsed: tokenService.getTokenCost(actionType),
          remainingBalance: 0, // We don't know the balance after failure
          action: actionType
        }
      };
    }
  }

  /**
   * PRESERVED: Original GPT-4o rewrite evaluation (without token integration)
   * Used internally after token validation
   */
  private async performOriginalRewriteEvaluation(
    originalScene: ScriptScene,
    rewrittenScene: ScriptRewrite,
    feedback: Feedback
  ): Promise<RewriteAnalysis> {
    console.log('📊 Performing original GPT-4o rewrite evaluation...', {
      originalId: originalScene.id,
      rewriteId: rewrittenScene.id,
      feedbackId: feedback.id
    });

    // PRESERVED: Original system prompt for GPT-4o
    const systemPrompt = `You are a script evaluator analyzing how well a rewrite addressed feedback.

You will be given:
1. Original scene
2. Rewritten scene  
3. Mentor feedback

Identify what was improved and what may have been lost or weakened.

Output strictly in this JSON format:
{
  "improvements": ["specific improvement 1", "specific improvement 2"],
  "regressions": ["specific regression 1", "specific regression 2"]
}

Be specific and actionable. Focus on dialogue, character development, pacing, structure, and emotional impact.`;

    // PRESERVED: Original user prompt construction
    const userPrompt = `Original Mentor Feedback:
"""
${feedback.content}
"""

Original Scene:
"""
${originalScene.content}
"""

Rewritten Scene:
"""
${rewrittenScene.content}
"""

Evaluate how well the rewrite addressed the mentor's feedback.`;

    try {
      // PRESERVED: Original backend API call with exact parameters
      const response = await fetch(`${this.baseUrl}/openai-rewrite-evaluation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          model: 'gpt-4o',
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.detail || response.statusText;
        
        console.error('❌ Rewrite evaluation API failed:', {
          status: response.status,
          error: errorMessage,
          detail: errorData
        });
        
        // PRESERVED: Specific error handling for different status codes
        if (response.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else if (response.status === 401) {
          throw new Error('OpenAI API authentication failed. Check API key configuration.');
        } else if (response.status === 402) {
          throw new Error('OpenAI API quota exceeded. Please check your billing.');
        } else {
          throw new Error(`AI evaluation failed: ${errorMessage} (Status: ${response.status})`);
        }
      }

      const data = await response.json();
      
      if (!data.content) {
        throw new Error('AI evaluation returned empty response');
      }

      let aiResponse;
      try {
        aiResponse = JSON.parse(data.content);
      } catch (parseError) {
        console.error('Failed to parse AI response:', data.content);
        throw new Error('AI evaluation returned invalid format');
      }

      const improvements = aiResponse.improvements || [];
      const regressions = aiResponse.regressions || [];
      
      // PRESERVED: Original scoring algorithm
      const improvementWeight = improvements.length * 20;
      const regressionPenalty = regressions.length * 15;
      const baseScore = 50;
      const overallScore = Math.max(0, Math.min(100, baseScore + improvementWeight - regressionPenalty));
      
      // PRESERVED: Original summary generation
      const summary = this.generateSummary(improvements, regressions, overallScore);
      
      console.log('✅ GPT-4o rewrite evaluation completed successfully', {
        improvements: improvements.length,
        regressions: regressions.length,
        score: overallScore
      });
      
      return {
        improvements,
        regressions,
        overallScore,
        summary
      };

    } catch (error) {
      console.error('❌ Rewrite evaluation failed:', error);
      throw error;
    }
  }

  /**
   * PRESERVED: Original summary generation with exact logic
   */
  private generateSummary(improvements: string[], regressions: string[], score: number): string {
    if (score >= 80) {
      return `Excellent rewrite! GPT-4o analysis shows ${improvements.length} key improvements with minimal issues.`;
    } else if (score >= 60) {
      return `Good rewrite with ${improvements.length} GPT-4o identified improvements, though ${regressions.length} areas need attention.`;
    } else if (score >= 40) {
      return `Mixed results according to GPT-4o analysis: ${improvements.length} improvements vs ${regressions.length} regressions.`;
    } else {
      return `GPT-4o analysis suggests significant revision needed: address ${regressions.length} issues while building on ${improvements.length} improvements.`;
    }
  }

  /**
   * PRESERVED: Original quick evaluation method (no token cost)
   */
  quickEvaluate(
    originalScene: ScriptScene,
    rewrittenScene: ScriptRewrite,
    feedback: Feedback
  ): { improved: boolean; summary: string } {
    const hasChanges = originalScene.content !== rewrittenScene.content;
    return {
      improved: hasChanges,
      summary: hasChanges ? 'Changes detected - full GPT-4o evaluation required' : 'No changes detected in rewrite'
    };
  }

  /**
   * NEW: Create empty analysis for error cases
   */
  private createEmptyAnalysis(): RewriteAnalysis {
    return {
      improvements: [],
      regressions: ['Evaluation failed - unable to analyze rewrite'],
      overallScore: 0,
      summary: 'Rewrite evaluation failed. Please try again.'
    };
  }

  /**
   * NEW: Validate tokens before rewrite evaluation (public method)
   */
  async validateTokensForRewriteEvaluation(userId: string): Promise<{
    canProceed: boolean;
    cost: number;
    currentBalance: number;
    shortfall?: number;
  }> {
    try {
      const cost = tokenService.getTokenCost('rewrite_suggestions');
      const validation = await tokenService.validateTokenBalance(userId, cost);
      
      return {
        canProceed: validation.hasEnoughTokens,
        cost,
        currentBalance: validation.currentBalance,
        shortfall: validation.shortfall
      };
    } catch (error) {
      console.error('Error validating tokens for rewrite evaluation:', error);
      return {
        canProceed: false,
        cost: tokenService.getTokenCost('rewrite_suggestions'),
        currentBalance: 0
      };
    }
  }

  /**
   * NEW: Get token cost for rewrite evaluation (public method)
   */
  getTokenCost(): number {
    return tokenService.getTokenCost('rewrite_suggestions');
  }

  /**
   * PRESERVED: Legacy method for backward compatibility (without token integration)
   */
  async evaluateRewriteLegacy(
    originalScene: ScriptScene,
    rewrittenScene: ScriptRewrite,
    feedback: Feedback
  ): Promise<RewriteAnalysis> {
    console.log('🔄 Legacy rewrite evaluation generation requested');
    
    return this.performOriginalRewriteEvaluation(originalScene, rewrittenScene, feedback);
  }

  /**
   * NEW: Batch rewrite evaluation for multiple rewrites (with token management)
   */
  async evaluateBatchRewrites(
    userId: string,
    evaluations: Array<{
      originalScene: ScriptScene;
      rewrittenScene: ScriptRewrite;
      feedback: Feedback;
      scriptId?: string;
    }>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Array<RewriteEvaluationResponse>> {
    console.log('📦 Processing batch rewrite evaluations:', {
      userId,
      evaluationCount: evaluations.length
    });

    const results: RewriteEvaluationResponse[] = [];
    
    for (let i = 0; i < evaluations.length; i++) {
      const evaluation = evaluations[i];
      
      try {
        const result = await this.evaluateRewrite({
          userId,
          actionType: 'rewrite_suggestions',
          originalScene: evaluation.originalScene,
          rewrittenScene: evaluation.rewrittenScene,
          feedback: evaluation.feedback,
          scriptId: evaluation.scriptId,
          mentorId: evaluation.feedback.mentorId,
          sceneId: evaluation.originalScene.id
        });
        
        results.push(result);
        onProgress?.(i + 1, evaluations.length);
        
      } catch (error) {
        console.error(`Failed to evaluate rewrite ${i + 1}:`, error);
        
        results.push({
          success: false,
          error: `Batch evaluation failed for rewrite ${i + 1}`,
          analysis: this.createEmptyAnalysis(),
          tokenInfo: {
            tokensUsed: 0,
            remainingBalance: 0,
            action: 'rewrite_suggestions'
          }
        });
      }
    }

    return results;
  }

  /**
   * NEW: Analyze rewrite complexity to estimate evaluation accuracy
   */
  analyzeRewriteComplexity(
    originalScene: ScriptScene,
    rewrittenScene: ScriptRewrite
  ): {
    changePercentage: number;
    complexity: 'minimal' | 'moderate' | 'substantial' | 'complete';
    changeTypes: string[];
  } {
    const originalLength = originalScene.content.length;
    const rewrittenLength = rewrittenScene.content.length;
    const lengthDiff = Math.abs(originalLength - rewrittenLength);
    const changePercentage = (lengthDiff / originalLength) * 100;
    
    const changeTypes = [];
    
    // Analyze types of changes
    if (rewrittenLength > originalLength * 1.2) {
      changeTypes.push('Content expansion');
    } else if (rewrittenLength < originalLength * 0.8) {
      changeTypes.push('Content reduction');
    }
    
    if (rewrittenScene.content.includes('INT.') !== originalScene.content.includes('INT.') ||
        rewrittenScene.content.includes('EXT.') !== originalScene.content.includes('EXT.')) {
      changeTypes.push('Location changes');
    }
    
    // Simple dialogue detection
    const originalDialogue = (originalScene.content.match(/^[A-Z][A-Z\s]+$/gm) || []).length;
    const rewrittenDialogue = (rewrittenScene.content.match(/^[A-Z][A-Z\s]+$/gm) || []).length;
    
    if (Math.abs(originalDialogue - rewrittenDialogue) > 2) {
      changeTypes.push('Dialogue modifications');
    }
    
    // Determine complexity
    let complexity: 'minimal' | 'moderate' | 'substantial' | 'complete';
    if (changePercentage < 10) {
      complexity = 'minimal';
    } else if (changePercentage < 30) {
      complexity = 'moderate';
    } else if (changePercentage < 70) {
      complexity = 'substantial';
    } else {
      complexity = 'complete';
    }
    
    return {
      changePercentage: Math.round(changePercentage),
      complexity,
      changeTypes
    };
  }

  /**
   * NEW: Get evaluation confidence based on content quality
   */
  getEvaluationConfidence(
    originalScene: ScriptScene,
    rewrittenScene: ScriptRewrite,
    feedback: Feedback
  ): {
    confidence: 'high' | 'medium' | 'low';
    factors: string[];
    recommendation: string;
  } {
    const factors = [];
    let confidenceScore = 100;
    
    // Check content quality factors
    if (originalScene.content.length < 100) {
      factors.push('Original scene is very short');
      confidenceScore -= 20;
    }
    
    if (rewrittenScene.content.length < 100) {
      factors.push('Rewritten scene is very short');
      confidenceScore -= 20;
    }
    
    const feedbackLength = feedback.content?.length || 
                          feedback.structuredContent?.length || 
                          feedback.scratchpadContent?.length || 0;
    
    if (feedbackLength < 50) {
      factors.push('Original feedback is minimal');
      confidenceScore -= 15;
    }
    
    if (originalScene.content === rewrittenScene.content) {
      factors.push('No changes detected between versions');
      confidenceScore -= 30;
    }
    
    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low';
    let recommendation: string;
    
    if (confidenceScore >= 80) {
      confidence = 'high';
      recommendation = 'Evaluation should provide reliable insights';
    } else if (confidenceScore >= 60) {
      confidence = 'medium';
      recommendation = 'Evaluation may provide useful insights with some limitations';
    } else {
      confidence = 'low';
      recommendation = 'Consider providing more substantial content for better evaluation';
    }
    
    return {
      confidence,
      factors,
      recommendation
    };
  }
}

export const rewriteEvaluationService = new RewriteEvaluationService();