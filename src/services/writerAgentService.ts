// src/services/writerAgentService.ts - Complete enhanced version with token integration + ALL original features
import { Feedback, Mentor, TokenAwareRequest, TokenAwareResponse } from '../types';
import { tokenService } from './tokenService';

// PRESERVED: Original interfaces
export interface WriterSuggestion {
  id: string;
  type: 'dialogue' | 'action' | 'structure' | 'character' | 'pacing';
  title: string;
  description: string;
  originalText?: string;
  suggestedText?: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  lineReference?: string;
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

// NEW: Token-aware interfaces
interface WriterAgentRequest extends TokenAwareRequest {
  feedback: Feedback;
  mentor: Mentor;
}

interface WriterAgentResponse extends TokenAwareResponse<WriterSuggestionsResponse> {
  suggestions: WriterSuggestionsResponse;
}

export class WriterAgentService {
  private baseUrl = 'https://smbackend-production.up.railway.app/api';

  /**
   * NEW: Token-aware writer suggestions generation
   * PRESERVED: All original enhanced blended feedback support
   */
  async generateWriterSuggestions(request: WriterAgentRequest): Promise<WriterAgentResponse> {
    const { userId, feedback, mentor, actionType = 'writer_agent', scriptId } = request;

    console.log('✍️ Writer Agent generating suggestions with token validation:', {
      userId,
      mentor: mentor.name,
      mentorId: mentor.id,
      feedbackId: feedback.id,
      feedbackType: this.determineFeedbackType(feedback),
      isBlended: mentor.id === 'blended',
      feedbackLength: this.getFeedbackText(feedback).length,
      actionType
    });

    try {
      // NEW: Step 1 - Token validation and deduction
      const tokenResult = await tokenService.processTokenTransaction(
        userId,
        actionType,
        scriptId,
        mentor.id
      );

      if (!tokenResult.success) {
        const errorMessage = tokenResult.validation.hasEnoughTokens 
          ? 'Token deduction failed due to system error'
          : `Insufficient tokens for Writer Agent. Need ${tokenResult.validation.requiredTokens}, have ${tokenResult.validation.currentBalance}`;
        
        return {
          success: false,
          error: errorMessage,
          suggestions: this.createEmptyWriterSuggestions(mentor.id),
          tokenInfo: {
            tokensUsed: 0,
            remainingBalance: tokenResult.validation.currentBalance,
            action: actionType
          }
        };
      }

      // PRESERVED: Step 2 - Original writer suggestions generation logic
      const suggestionsResult = await this.performOriginalWriterSuggestions(feedback, mentor);
      
      return {
        success: true,
        suggestions: suggestionsResult,
        data: suggestionsResult,
        tokenInfo: {
          tokensUsed: tokenService.getTokenCost(actionType),
          remainingBalance: tokenResult.validation.currentBalance,
          action: actionType
        }
      };

    } catch (error: any) {
      console.error('❌ Writer Agent generation failed:', error);
      
      return {
        success: false,
        error: `Writer suggestions generation failed: ${error.message}`,
        suggestions: this.createEmptyWriterSuggestions(mentor.id),
        tokenInfo: {
          tokensUsed: tokenService.getTokenCost(actionType),
          remainingBalance: 0, // We don't know the balance after failure
          action: actionType
        }
      };
    }
  }

  /**
   * PRESERVED: Original writer suggestions generation with enhanced blended feedback support
   * Used internally after token validation
   */
  private async performOriginalWriterSuggestions(
    feedback: Feedback,
    mentor: Mentor
  ): Promise<WriterSuggestionsResponse> {
    console.log('✍️ Writer Agent: Generating suggestions...', {
      mentor: mentor.name,
      mentorId: mentor.id,
      feedbackId: feedback.id,
      feedbackType: this.determineFeedbackType(feedback),
      isBlended: mentor.id === 'blended',
      feedbackLength: this.getFeedbackText(feedback).length
    });
  
    try {
      // PRESERVED: Get the feedback text (prefer structured over legacy content)
      const feedbackText = this.getFeedbackText(feedback);
      
      if (!feedbackText || feedbackText.trim().length === 0) {
        console.error('❌ No valid feedback content found for writer suggestions');
        throw new Error('No valid feedback content found');
      }
  
      // PRESERVED: Additional validation for blended feedback
      if (mentor.id === 'blended') {
        console.log('🎭 Processing blended mentor feedback for writer suggestions');
        
        // Ensure blended feedback has sufficient content
        if (feedbackText.length < 50) {
          console.warn('⚠️ Blended feedback content is very short:', feedbackText.length, 'characters');
        }
      }
      
      // PRESERVED: Enhanced request payload for blended feedback
      const requestPayload = {
        feedback_text: feedbackText,
        mentor_id: mentor.id,
        feedback_context: {
          type: this.determineFeedbackType(feedback),
          categories: feedback.categories || {},
          timestamp: feedback.timestamp,
          is_blended: mentor.id === 'blended',
          mentor_name: mentor.name, // PRESERVED: Include mentor name for better processing
          ...(mentor.id === 'blended' && {
            blended_context: 'This feedback combines insights from multiple mentoring perspectives',
            blended_tone: mentor.tone || 'Multi-perspective approach'
          })
        }
      };
  
      console.log('📤 Sending writer suggestions request:', {
        mentorId: mentor.id,
        isBlended: mentor.id === 'blended',
        feedbackLength: feedbackText.length,
        hasCategories: !!(feedback.categories && Object.keys(feedback.categories).length > 0)
      });
      
      // IMPROVED: Add retry logic with exponential backoff
      let retryCount = 0;
      const maxRetries = 3;
      let lastError: Error | null = null;

      while (retryCount <= maxRetries) {
        try {
          const response = await fetch(`${this.baseUrl}/generate-writer-suggestions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload)
          });
      
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = `Writer Agent API Error: ${response.status} - ${errorData.error || response.statusText}`;
            
            // Check for rate limit errors (429 status code)
            if (response.status === 429) {
              const waitTimeMatch = errorMessage.match(/try again in (\d+\.\d+)s/);
              let waitTime = Math.pow(2, retryCount) * 1000; // Default exponential backoff
              
              if (waitTimeMatch && waitTimeMatch[1]) {
                waitTime = parseFloat(waitTimeMatch[1]) * 1000 + 1000; // Convert to ms and add 1 second buffer
              }
              
              console.log(`🕒 Rate limit hit, waiting for ${waitTime/1000} seconds before retry...`);
              
              // Wait for the specified time
              await new Promise(resolve => setTimeout(resolve, waitTime));
              
              // Increment retry count and try again
              retryCount++;
              continue;
            }
            
            throw new Error(errorMessage);
          }
      
          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.error || 'Writer suggestions generation failed');
          }
      
          console.log('✅ Writer suggestions generated successfully:', {
            suggestionsCount: data.suggestions?.length || 0,
            mentor: mentor.name,
            isBlended: mentor.id === 'blended',
            source: 'API'
          });
      
          // Ensure suggestions have proper structure
          if (data.suggestions && Array.isArray(data.suggestions)) {
            // Add IDs to suggestions if they don't have them
            data.suggestions = data.suggestions.map((suggestion, index) => ({
              id: suggestion.id || `suggestion-${Date.now()}-${index}`,
              ...suggestion
            }));
          }
          
          return data;
        } catch (error) {
          // Store the error for potential re-throw
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // Check for rate limit errors in the error message
          if (lastError.message.includes('rate limit') || 
              lastError.message.includes('429') || 
              lastError.message.includes('try again in')) {
            
            // Extract wait time if available
            const waitTimeMatch = lastError.message.match(/try again in (\d+\.\d+)s/);
            let waitTime = Math.pow(2, retryCount) * 1000; // Default exponential backoff
            
            if (waitTimeMatch && waitTimeMatch[1]) {
              waitTime = parseFloat(waitTimeMatch[1]) * 1000 + 1000; // Convert to ms and add 1 second buffer
            }
            
            console.log(`🕒 Rate limit detected, waiting for ${waitTime/1000} seconds before retry...`);
            
            // Wait for the specified time
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Increment retry count and try again
            retryCount++;
            continue;
          }
          
          // If we've reached max retries or it's not a rate limit error, break the loop
          if (retryCount >= maxRetries || 
              !(lastError.message.includes('rate limit') || 
                lastError.message.includes('429') || 
                lastError.message.includes('try again in'))) {
            break;
          }
          
          // Otherwise, use exponential backoff
          const backoffTime = Math.pow(2, retryCount) * 1000;
          console.log(`⏱️ Retrying after ${backoffTime/1000} seconds (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retryCount++;
        }
      }
      
      // If we've exhausted all retries or encountered a non-rate-limit error, fall back to mock suggestions
      console.warn('❌ Writer Agent API failed, falling back to enhanced mock suggestions:', lastError);
      return this.generateEnhancedMockSuggestions(feedback, mentor);
    } catch (error) {
      console.warn('❌ Writer Agent API failed, falling back to enhanced mock suggestions:', error);
      
      // PRESERVED: Always fallback to mock suggestions rather than throwing
      return this.generateEnhancedMockSuggestions(feedback, mentor);
    }
  }

  /**
   * PRESERVED: Determine the type of feedback for better processing
   */
  private determineFeedbackType(feedback: Feedback): string {
    if ((feedback as any).chunkId) return 'chunk';
    if (feedback.isChunked || (feedback as any).chunks) return 'chunked';
    return 'single';
  }

  /**
   * PRESERVED: Extract feedback text from feedback object with improved handling for blended feedback
   */
  private getFeedbackText(feedback: Feedback): string {
    console.log('🔍 Extracting feedback text...', {
      hasStructured: !!feedback.structuredContent,
      hasScratchpad: !!feedback.scratchpadContent,
      hasLegacyContent: !!(feedback as any).content,
      isBlended: feedback.mentorId === 'blended',
      isChunked: feedback.isChunked || !!(feedback as any).chunks,
      feedbackId: feedback.id
    });
  
    // For chunked feedback, we should have either structured or scratchpad content
    let feedbackText = '';
    
    // PRESERVED: Better prioritization for blended feedback
    // Prefer structured content for blended feedback as it's more comprehensive
    if (feedback.structuredContent && feedback.structuredContent.trim()) {
      feedbackText = feedback.structuredContent;
      console.log('📝 Using structured content:', feedbackText.length, 'characters');
    } 
    // Fall back to scratchpad content if structured is not available
    else if (feedback.scratchpadContent && feedback.scratchpadContent.trim()) {
      feedbackText = feedback.scratchpadContent;
      console.log('📝 Using scratchpad content:', feedbackText.length, 'characters');
    }
    // Legacy content fallback
    else if ((feedback as any).content && (feedback as any).content.trim()) {
      feedbackText = (feedback as any).content;
      console.log('📝 Using legacy content:', feedbackText.length, 'characters');
    }
  
    // PRESERVED: Additional validation with better error handling
    if (!feedbackText || feedbackText.trim().length < 10) {
      console.warn('⚠️ Insufficient feedback content found:', {
        structuredLength: feedback.structuredContent?.length || 0,
        scratchpadLength: feedback.scratchpadContent?.length || 0,
        legacyLength: (feedback as any).content?.length || 0,
        isBlended: feedback.mentorId === 'blended',
        feedbackId: feedback.id
      });
      
      // PRESERVED: Create more detailed fallback for blended feedback
      return this.createFallbackFeedbackText(feedback);
    }
  
    // PRESERVED: Post-processing for blended feedback
    if (feedback.mentorId === 'blended' && feedbackText.length > 0) {
      console.log('🎭 Post-processing blended feedback text');
      
      // Ensure blended feedback is clearly marked
      if (!feedbackText.toLowerCase().includes('blend') && !feedbackText.toLowerCase().includes('multiple')) {
        feedbackText = `Blended mentor analysis:\n\n${feedbackText}`;
      }
    }
  
    console.log('✅ Feedback text extracted successfully:', {
      length: feedbackText.length,
      source: feedback.structuredContent ? 'structured' : 
              feedback.scratchpadContent ? 'scratchpad' : 'legacy',
      isBlended: feedback.mentorId === 'blended',
      preview: feedbackText.substring(0, 100) + (feedbackText.length > 100 ? '...' : '')
    });
  
    return feedbackText;
  }

  /**
   * PRESERVED: Create fallback feedback text when no valid content is found
   */
  private createFallbackFeedbackText(feedback: Feedback): string {
    const mentor = feedback.mentorId;
    const categories = feedback.categories || {};
    const isBlended = mentor === 'blended';
    
    let fallbackText = isBlended 
      ? `Blended feedback analysis combining multiple mentoring perspectives:\n\n`
      : `Feedback from ${mentor}:\n\n`;
    
    // PRESERVED: Better category handling for blended feedback
    const categoryEntries = Object.entries(categories);
    if (categoryEntries.length > 0) {
      categoryEntries.forEach(([category, content]) => {
        if (content && typeof content === 'string' && content.trim()) {
          const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
          if (isBlended) {
            fallbackText += `${categoryTitle} (Multiple Perspectives): ${content}\n\n`;
          } else {
            fallbackText += `${categoryTitle}: ${content}\n\n`;
          }
        }
      });
    }
    
    // PRESERVED: If still no content, create very basic fallback with enhanced blended handling
    if (fallbackText.trim().length < 100) {
      const contextText = (feedback as any).chunkId ? 'this section' : 'the scene';
      
      if (isBlended) {
        fallbackText = `Blended analysis completed combining insights from multiple mentoring perspectives. ` +
          `Review ${contextText} for improvements in structure, dialogue, pacing, and character development ` +
          `using diverse mentoring approaches. This analysis incorporates various professional perspectives ` +
          `to provide comprehensive feedback covering multiple aspects of screenplay craft.`;
      } else {
        fallbackText = `General feedback analysis completed. Review ${contextText} for improvements ` +
          `in structure, dialogue, pacing, and character development.`;
      }
    }
    
    console.log('🔧 Created fallback feedback text:', {
      length: fallbackText.length,
      isBlended,
      hasCategories: Object.keys(categories).length > 0,
      contextType: (feedback as any).chunkId ? 'chunk' : 'scene'
    });
    
    return fallbackText;
  }

  /**
   * PRESERVED: Generate enhanced mock suggestions with better blended feedback support
   */
  private generateEnhancedMockSuggestions(
    feedback: Feedback,
    mentor: Mentor
  ): WriterSuggestionsResponse {
    const isBlended = mentor.id === 'blended';
    
    console.log('🎭 Writer Agent: Generating enhanced mock suggestions...', {
      mentor: mentor.name,
      feedbackType: this.determineFeedbackType(feedback),
      isBlended
    });
    
    const feedbackText = this.getFeedbackText(feedback);
    const suggestions: WriterSuggestion[] = [];

    if (isBlended) {
      // PRESERVED: Generate blended suggestions that combine multiple perspectives
      const blendedIssues = this.extractBlendedIssuesFromFeedback(feedbackText);
      
      blendedIssues.forEach((issue, index) => {
        const suggestion = this.generateBlendedSuggestionForIssue(issue);
        if (suggestion) {
          suggestions.push({
            id: `blended-suggestion-${Date.now()}-${index}`,
            type: ['dialogue', 'structure', 'character', 'action', 'pacing'][index % 5] as any,
            title: issue,
            description: suggestion.note,
            reasoning: suggestion.suggestion,
            priority: ['high', 'medium', 'low'][index % 3] as any,
            originalText: index % 2 === 0 ? 'Original text would appear here' : undefined,
            suggestedText: index % 2 === 0 ? 'Suggested improved text would appear here' : undefined
          });
        }
      });
      
      // PRESERVED: Ensure we have comprehensive blended suggestions
      if (suggestions.length < 3) {
        const defaultBlendedSuggestions = this.getDefaultBlendedSuggestions();
        defaultBlendedSuggestions.slice(0, 4 - suggestions.length).forEach((suggestion, index) => {
          suggestions.push({
            id: `default-blended-suggestion-${Date.now()}-${index}`,
            type: ['dialogue', 'structure', 'character', 'action', 'pacing'][index % 5] as any,
            title: suggestion.note,
            description: suggestion.note,
            reasoning: suggestion.suggestion,
            priority: ['medium', 'high', 'low'][index % 3] as any
          });
        });
      }
    } else {
      // PRESERVED: Generate regular mentor-specific suggestions
      const issues = this.extractIssuesFromFeedback(feedbackText, mentor);
      
      issues.forEach((issue, index) => {
        const suggestion = this.generateSuggestionForIssue(issue, mentor);
        if (suggestion) {
          suggestions.push({
            id: `suggestion-${Date.now()}-${index}`,
            type: ['dialogue', 'structure', 'character', 'action', 'pacing'][index % 5] as any,
            title: issue,
            description: issue,
            reasoning: suggestion,
            priority: ['high', 'medium', 'low'][index % 3] as any,
            originalText: index % 2 === 0 ? 'Original text would appear here' : undefined,
            suggestedText: index % 2 === 0 ? 'Suggested improved text would appear here' : undefined
          });
        }
      });

      // PRESERVED: Ensure we have at least 2-3 suggestions
      if (suggestions.length < 2) {
        const defaultSuggestions = this.getDefaultSuggestions(mentor);
        defaultSuggestions.slice(0, 3 - suggestions.length).forEach((suggestion, index) => {
          suggestions.push({
            id: `default-suggestion-${Date.now()}-${index}`,
            type: ['dialogue', 'structure', 'character', 'action', 'pacing'][index % 5] as any,
            title: suggestion.note,
            description: suggestion.note,
            reasoning: suggestion,
            priority: ['medium', 'high', 'low'][index % 3] as any
          });
        });
      }
    }

    console.log('✅ Enhanced mock suggestions generated:', {
      suggestionsCount: suggestions.length,
      mentor: mentor.name,
      isBlended,
      source: 'enhanced_mock'
    });

    return {
      suggestions: suggestions.slice(0, 6), // Limit to 6
      success: true,
      mentor_id: mentor.id,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * PRESERVED: Extract issues from blended feedback that combines multiple perspectives
   */
  private extractBlendedIssuesFromFeedback(feedbackText: string): string[] {
    const issues: string[] = [];
    const lowercaseText = feedbackText.toLowerCase();

    // PRESERVED: Blended-specific issue patterns that indicate consensus across mentors
    const blendedPatterns = [
      { 
        pattern: /(?:multiple|several|various).+(?:mentor|perspective|approach).+(?:agree|consensus|similar)/i, 
        issue: 'Multiple mentors agree this area needs attention' 
      },
      { 
        pattern: /(?:combine|blend|integrate).+(?:approach|style|feedback)/i, 
        issue: 'Blended approach reveals deeper issues' 
      },
      { 
        pattern: /(?:dialogue|conversation).+(?:weak|strong|improve)/i, 
        issue: 'Dialogue effectiveness varies across mentoring perspectives' 
      },
      { 
        pattern: /(?:structure|organization).+(?:multiple|different).+(?:view|perspective)/i, 
        issue: 'Structural issues identified from multiple angles' 
      },
      { 
        pattern: /(?:character|motivation).+(?:consistent|inconsistent).+(?:analysis|feedback)/i, 
        issue: 'Character development needs multi-perspective refinement' 
      },
      { 
        pattern: /(?:pacing|rhythm|flow).+(?:vary|different|conflict)/i, 
        issue: 'Pacing receives mixed feedback across mentoring styles' 
      }
    ];

    blendedPatterns.forEach(({ pattern, issue }) => {
      if (pattern.test(feedbackText)) {
        issues.push(issue);
      }
    });

    // PRESERVED: If no blended-specific patterns, extract general issues and frame them as blended
    if (issues.length === 0) {
      const generalPatterns = [
        { pattern: /dialogue/i, issue: 'Dialogue quality assessed from multiple mentoring perspectives' },
        { pattern: /pacing/i, issue: 'Pacing analyzed through diverse mentoring approaches' },
        { pattern: /character/i, issue: 'Character development viewed through multiple lenses' },
        { pattern: /structure/i, issue: 'Structural elements evaluated across mentoring styles' },
        { pattern: /conflict/i, issue: 'Conflict effectiveness reviewed from various angles' }
      ];

      generalPatterns.forEach(({ pattern, issue }) => {
        if (pattern.test(feedbackText)) {
          issues.push(issue);
        }
      });
    }

    return issues.slice(0, 5); // Limit to 5 blended issues
  }

  /**
   * PRESERVED: Generate blended suggestions that combine multiple mentoring perspectives
   */
  private generateBlendedSuggestionForIssue(issue: string): { note: string; suggestion: string } | null {
    const blendedSuggestions: Record<string, string> = {
      'Multiple mentors agree this area needs attention': 'Address this priority area by combining Tony Gilroy\'s precision cuts with Sofia Coppola\'s atmospheric details and Vince Gilligan\'s character psychology.',
      'Blended approach reveals deeper issues': 'Use Amy Pascal\'s audience connection principles while applying Tony Gilroy\'s story engine clarity and Sofia Coppola\'s emotional authenticity.',
      'Dialogue effectiveness varies across mentoring perspectives': 'Balance Tony Gilroy\'s economy of words with Sofia Coppola\'s subtext and Vince Gilligan\'s character-revealing dialogue to create multi-layered conversations.',
      'Structural issues identified from multiple angles': 'Apply Tony Gilroy\'s structural discipline while incorporating Sofia Coppola\'s organic pacing and ensuring Amy Pascal\'s audience accessibility.',
      'Character development needs multi-perspective refinement': 'Combine Vince Gilligan\'s psychological depth with Amy Pascal\'s relatability and Sofia Coppola\'s authentic emotional moments.',
      'Pacing receives mixed feedback across mentoring styles': 'Find the sweet spot between Tony Gilroy\'s tight efficiency, Sofia Coppola\'s breathing room, and Netflix\'s engagement momentum.',
      'Dialogue quality assessed from multiple mentoring perspectives': 'Craft dialogue that serves Tony Gilroy\'s plot advancement, Sofia Coppola\'s subtext, and Vince Gilligan\'s character psychology simultaneously.',
      'Pacing analyzed through diverse mentoring approaches': 'Create pacing that satisfies Tony Gilroy\'s efficiency, Sofia Coppola\'s naturalism, and Netflix\'s viewer retention needs.',
      'Character development viewed through multiple lenses': 'Develop characters with Vince Gilligan\'s psychological complexity, Amy Pascal\'s universal appeal, and Sofia Coppola\'s authentic details.',
      'Structural elements evaluated across mentoring styles': 'Build structure using Tony Gilroy\'s precision, Sofia Coppola\'s organic flow, and Amy Pascal\'s clear emotional through-lines.',
      'Conflict effectiveness reviewed from various angles': 'Strengthen conflict using Tony Gilroy\'s specificity, Vince Gilligan\'s moral complexity, and Amy Pascal\'s relatable stakes.'
    };

    const suggestion = blendedSuggestions[issue];
    
    if (suggestion) {
      return {
        note: issue,
        suggestion
      };
    }

    return null;
  }

  /**
   * PRESERVED: Get default blended suggestions that combine multiple mentoring perspectives
   */
  private getDefaultBlendedSuggestions(): { note: string; suggestion: string }[] {
    return [
      { 
        note: 'Scene needs multi-perspective refinement', 
        suggestion: 'Apply Tony Gilroy\'s "cut what doesn\'t serve" principle while maintaining Sofia Coppola\'s emotional authenticity and Vince Gilligan\'s character psychology.' 
      },
      { 
        note: 'Dialogue requires blended approach', 
        suggestion: 'Balance Tony Gilroy\'s efficiency with Sofia Coppola\'s subtext and ensure Amy Pascal\'s audience accessibility in every line.' 
      },
      { 
        note: 'Pacing needs harmonic balance', 
        suggestion: 'Find the rhythm that satisfies Tony Gilroy\'s momentum, Sofia Coppola\'s breathing space, and Netflix\'s engagement requirements.' 
      },
      { 
        note: 'Character development lacks multi-dimensional depth', 
        suggestion: 'Combine Vince Gilligan\'s psychological truth with Amy Pascal\'s relatability and Sofia Coppola\'s authentic emotional details.' 
      },
      { 
        note: 'Structure needs integrated approach', 
        suggestion: 'Build using Tony Gilroy\'s precision, Sofia Coppola\'s organic development, and Amy Pascal\'s clear emotional stakes.' 
      }
    ];
  }

  /**
   * PRESERVED: Extract key issues from feedback text with improved pattern matching
   */
  private extractIssuesFromFeedback(feedbackText: string, mentor: Mentor): string[] {
    const issues: string[] = [];
    const lowercaseText = feedbackText.toLowerCase();

    // PRESERVED: Enhanced issue patterns with more specific detection
    const issuePatterns = [
      { 
        pattern: /dialogue.*(?:weak|stiff|unnatural|exposition|telling|clunky)/i, 
        issue: 'Dialogue feels unnatural or expository' 
      },
      { 
        pattern: /dialogue.*(?:improve|enhance|strengthen|better)/i, 
        issue: 'Dialogue needs improvement' 
      },
      { 
        pattern: /pacing.*(?:slow|drag|rushed|uneven|timing)/i, 
        issue: 'Pacing issues need attention' 
      },
      { 
        pattern: /character.*(?:motivation|objective|want|goal|unclear)/i, 
        issue: 'Character motivation needs clarification' 
      },
      { 
        pattern: /structure.*(?:loose|unclear|confusing|disorganized)/i, 
        issue: 'Scene structure needs tightening' 
      },
      { 
        pattern: /conflict.*(?:weak|absent|unclear|lack)/i, 
        issue: 'Conflict needs strengthening' 
      },
      { 
        pattern: /visual.*(?:improve|enhance|show|cinematic)/i, 
        issue: 'Visual storytelling can be enhanced' 
      },
      { 
        pattern: /emotion.*(?:authentic|real|genuine|feel)/i, 
        issue: 'Emotional authenticity needs work' 
      },
      { 
        pattern: /(?:show.*tell|exposition|explaining)/i, 
        issue: 'Too much telling, not enough showing' 
      },
      { 
        pattern: /(?:cut|trim|remove|unnecessary|redundant)/i, 
        issue: 'Content needs trimming' 
      }
    ];

    issuePatterns.forEach(({ pattern, issue }) => {
      if (pattern.test(feedbackText)) {
        issues.push(issue);
      }
    });

    // PRESERVED: Add mentor-specific issues based on content analysis
    switch (mentor.id) {
      case 'tony-gilroy':
        if (lowercaseText.includes('cut') || lowercaseText.includes('unnecessary') || lowercaseText.includes('remove')) {
          issues.push('Scene contains elements that don\'t serve the story');
        }
        if (lowercaseText.includes('engine') || lowercaseText.includes('drive') || lowercaseText.includes('forward')) {
          issues.push('Story engine needs clarification');
        }
        if (lowercaseText.includes('purpose') || lowercaseText.includes('why')) {
          issues.push('Scene purpose is unclear');
        }
        break;
        
      case 'sofia-coppola':
        if (lowercaseText.includes('silence') || lowercaseText.includes('subtext') || lowercaseText.includes('unspoken')) {
          issues.push('Subtext and atmospheric details need enhancement');
        }
        if (lowercaseText.includes('authentic') || lowercaseText.includes('real') || lowercaseText.includes('genuine')) {
          issues.push('Emotional authenticity requires attention');
        }
        if (lowercaseText.includes('mood') || lowercaseText.includes('atmosphere') || lowercaseText.includes('feeling')) {
          issues.push('Atmospheric storytelling needs development');
        }
        break;
        
      case 'vince-gilligan':
        if (lowercaseText.includes('psychology') || lowercaseText.includes('choice') || lowercaseText.includes('decision')) {
          issues.push('Character psychology needs deepening');
        }
        if (lowercaseText.includes('consequence') || lowercaseText.includes('result') || lowercaseText.includes('inevitable')) {
          issues.push('Character actions need clearer consequences');
        }
        if (lowercaseText.includes('moral') || lowercaseText.includes('right') || lowercaseText.includes('wrong')) {
          issues.push('Moral complexity needs development');
        }
        break;
        
      case 'amy-pascal':
        if (lowercaseText.includes('audience') || lowercaseText.includes('connect') || lowercaseText.includes('relate')) {
          issues.push('Audience connection needs strengthening');
        }
        if (lowercaseText.includes('relatable') || lowercaseText.includes('care') || lowercaseText.includes('sympathetic')) {
          issues.push('Character relatability needs work');
        }
        if (lowercaseText.includes('universal') || lowercaseText.includes('human')) {
          issues.push('Universal themes need emphasis');
        }
        break;
        
      case 'netflix-exec':
        if (lowercaseText.includes('engagement') || lowercaseText.includes('hook') || lowercaseText.includes('compelling')) {
          issues.push('Engagement and hooks need optimization');
        }
        if (lowercaseText.includes('momentum') || lowercaseText.includes('forward') || lowercaseText.includes('pace')) {
          issues.push('Forward momentum requires enhancement');
        }
        if (lowercaseText.includes('audience') || lowercaseText.includes('viewer') || lowercaseText.includes('watch')) {
          issues.push('Viewer retention needs consideration');
        }
        break;
    }

    // PRESERVED: Remove duplicates and limit to reasonable number
    const uniqueIssues = [...new Set(issues)];
    return uniqueIssues.slice(0, 6);
  }

  /**
   * PRESERVED: Generate a suggestion for a specific issue with mentor-specific advice
   */
  private generateSuggestionForIssue(issue: string, mentor: Mentor): string {
    const suggestions: Record<string, Record<string, string>> = {
      'tony-gilroy': {
        'Dialogue feels unnatural or expository': 'Cut any dialogue that doesn\'t advance plot or reveal character. Make every line count.',
        'Dialogue needs improvement': 'Test each line: does it move the story forward or deepen character? If not, cut it.',
        'Pacing issues need attention': 'Start each scene as late as possible, end as early as possible. Cut the setup.',
        'Character motivation needs clarification': 'Give each character a clear, specific objective they actively pursue in every scene.',
        'Scene structure needs tightening': 'Ask: if you cut this scene, does anything break? If not, it doesn\'t belong.',
        'Conflict needs strengthening': 'Find the real disagreement hiding under surface politeness. Make it specific.',
        'Scene contains elements that don\'t serve the story': 'Ruthlessly cut anything that doesn\'t serve the story engine. Be brutal.',
        'Story engine needs clarification': 'Identify what drives this story forward and make it crystal clear.',
        'Scene purpose is unclear': 'Every scene must serve the story. If you can\'t explain why it\'s there, cut it.',
        'Content needs trimming': 'Cut the first thing that comes to mind, then cut again. Keep only what\'s essential.'
      },
      'sofia-coppola': {
        'Dialogue feels unnatural or expository': 'Let characters communicate through behavior and subtext, not just words.',
        'Dialogue needs improvement': 'Trust silences. Often what\'s not said is more powerful than what is.',
        'Pacing issues need attention': 'Allow natural pauses and breathing room. Rhythm should feel organic.',
        'Character motivation needs clarification': 'Show character psychology through small, authentic details and moments.',
        'Emotional authenticity needs work': 'Replace explanations of feelings with genuine moments of human truth.',
        'Subtext and atmospheric details need enhancement': 'Add environmental details that reflect character emotions and inner life.',
        'Visual storytelling can be enhanced': 'Use setting, objects, and atmosphere to reveal character without words.',
        'Atmospheric storytelling needs development': 'Create mood through carefully chosen details that resonate emotionally.',
        'Too much telling, not enough showing': 'Find the visual or behavioral equivalent of emotional exposition.'
      },
      'vince-gilligan': {
        'Dialogue feels unnatural or expository': 'Make each line reveal character psychology while advancing the plot.',
        'Character motivation needs clarification': 'Root choices in character flaws and psychological truth, not plot convenience.',
        'Character psychology needs deepening': 'Ask: why does THIS character make THIS choice at THIS moment?',
        'Character actions need clearer consequences': 'Show how character flaws create their own inevitable problems.',
        'Conflict needs strengthening': 'Build moral complexity where no choice is clearly right or wrong.',
        'Moral complexity needs development': 'Give characters impossible choices that reveal their true nature.',
        'Scene structure needs tightening': 'Each scene should tighten the psychological and moral screws on your character.',
        'Emotional authenticity needs work': 'Ground every choice in character psychology, not plot necessity.'
      },
      'amy-pascal': {
        'Character motivation needs clarification': 'Make character struggles universally relatable while keeping them specific.',
        'Audience connection needs strengthening': 'Find the human truth everyone can understand, regardless of circumstance.',
        'Character relatability needs work': 'Balance character flaws with genuinely sympathetic qualities.',
        'Emotional authenticity needs work': 'Ground complex situations in clear, understandable emotional stakes.',
        'Universal themes need emphasis': 'Connect specific story details to broader human experiences.',
        'Scene structure needs tightening': 'Ensure every scene serves both plot and emotional character development.',
        'Dialogue needs improvement': 'Make dialogue sound like real people talking, not characters delivering information.',
        'Visual storytelling can be enhanced': 'Show character emotions through actions that anyone can understand.'
      },
      'netflix-exec': {
        'Pacing issues need attention': 'Add forward momentum - every scene should create questions that demand answers.',
        'Engagement and hooks need optimization': 'Start with the most compelling, surprising moment possible.',
        'Forward momentum requires enhancement': 'End scenes with unresolved tension that pulls viewers to the next beat.',
        'Visual storytelling can be enhanced': 'Optimize for visual impact while meeting genre expectations.',
        'Scene structure needs tightening': 'Eliminate any moment that doesn\'t either reveal character or advance plot.',
        'Viewer retention needs consideration': 'Create moments that make it impossible to look away or turn off.',
        'Character motivation needs clarification': 'Make stakes personal and urgent - what does the character risk losing?',
        'Conflict needs strengthening': 'Escalate tension consistently - each scene should raise the stakes.'
      }
    };

    const mentorSuggestions = suggestions[mentor.id] || suggestions['tony-gilroy'];
    return mentorSuggestions[issue] || 'Improve this aspect based on the feedback provided.';
  }

  /**
   * PRESERVED: Get default suggestions for each mentor with improved quality
   */
  private getDefaultSuggestions(mentor: Mentor): string[] {
    const defaults: Record<string, string[]> = {
      'tony-gilroy': [
        'Identify what this scene must accomplish for the story, then cut everything else.',
        'Give each character a specific, actable objective they pursue throughout the scene.',
        'Find the real, specific disagreement hiding under polite surface conversation.',
        'Start the scene later - cut the setup and jump into the conflict.'
      ],
      'sofia-coppola': [
        'Trust silences and small gestures over explanatory dialogue.',
        'Add atmospheric details that reflect and amplify character psychology.',
        'Let characters reveal feelings through behavior and subtext, not words.',
        'Find the authentic human moment hiding under the plot mechanics.'
      ],
      'vince-gilligan': [
        'Ground every decision in established character psychology and flaws.',
        'Create choices where no option is clearly right or wrong.',
        'Show how character weaknesses create their own inevitable problems.',
        'Dig deeper into why THIS character makes THIS choice now.'
      ],
      'amy-pascal': [
        'Find the universal emotional truth everyone can understand and connect with.',
        'Make crystal clear what the character personally risks losing in this moment.',
        'Show the human struggle underneath the specific plot situation.',
        'Balance character flaws with genuinely sympathetic, relatable qualities.'
      ],
      'netflix-exec': [
        'Start with the most compelling, surprising moment that raises immediate questions.',
        'Add forward momentum that makes viewers need to know what happens next.',
        'Deliver on the specific promises this genre makes to its audience.',
        'Create moments of tension or surprise that make it impossible to look away.'
      ]
    };

    return defaults[mentor.id] || defaults['tony-gilroy'];
  }

  /**
   * NEW: Create empty writer suggestions for error cases
   */
  private createEmptyWriterSuggestions(mentorId: string): WriterSuggestionsResponse {
    return {
      suggestions: [],
      success: false,
      mentor_id: mentorId,
      timestamp: new Date().toISOString(),
      error: 'Writer suggestions generation failed. Please try again.'
    };
  }

  /**
   * PRESERVED: Test the writer agent service
   */
  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log('🔍 Testing Writer Agent connection...');
      
      const response = await fetch(`${this.baseUrl}/health`);
      
      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
      const data = await response.json();
      return {
        success: true,
        message: 'Writer Agent connection successful',
        data
      };
    } catch (error) {
      return {
        success: false,
        message: `Writer Agent connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * NEW: Validate tokens before writer agent processing (public method)
   */
  async validateTokensForWriterAgent(userId: string): Promise<{
    canProceed: boolean;
    cost: number;
    currentBalance: number;
    shortfall?: number;
  }> {
    try {
      const cost = tokenService.getTokenCost('writer_agent');
      const validation = await tokenService.validateTokenBalance(userId, cost);
      
      return {
        canProceed: validation.hasEnoughTokens,
        cost,
        currentBalance: validation.currentBalance,
        shortfall: validation.shortfall
      };
    } catch (error) {
      console.error('Error validating tokens for writer agent:', error);
      return {
        canProceed: false,
        cost: tokenService.getTokenCost('writer_agent'),
        currentBalance: 0
      };
    }
  }

  /**
   * NEW: Get token cost for writer agent (public method)
   */
  getTokenCost(): number {
    return tokenService.getTokenCost('writer_agent');
  }

  /**
   * PRESERVED: Legacy method for backward compatibility (without token integration)
   */
  async generateWriterSuggestionsLegacy(
    feedback: Feedback,
    mentor: Mentor
  ): Promise<WriterSuggestionsResponse> {
    console.log('🔄 Legacy writer suggestions generation requested');
    
    return this.performOriginalWriterSuggestions(feedback, mentor);
  }
}

export const writerAgentService = new WriterAgentService();