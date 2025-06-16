// src/services/rewriteEvaluationService.ts
import { ScriptScene, Feedback, ScriptRewrite } from '../types';

interface RewriteAnalysis {
  improvements: string[];
  regressions: string[];
  overallScore: number;
  summary: string;
}

class RewriteEvaluationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'https://smbackend-production.up.railway.app/api';
  }

  async evaluateRewrite(
    originalScene: ScriptScene,
    rewrittenScene: ScriptRewrite,
    feedback: Feedback
  ): Promise<RewriteAnalysis> {
    console.log('📊 Evaluating rewrite with GPT-4o...', {
      originalId: originalScene.id,
      rewriteId: rewrittenScene.id,
      feedbackId: feedback.id
    });

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
      
      // Calculate score based on AI analysis
      const improvementWeight = improvements.length * 20;
      const regressionPenalty = regressions.length * 15;
      const baseScore = 50;
      const overallScore = Math.max(0, Math.min(100, baseScore + improvementWeight - regressionPenalty));
      
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
}

export const rewriteEvaluationService = new RewriteEvaluationService();