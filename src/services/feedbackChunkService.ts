// src/services/feedbackChunkService.ts - FIXED: Updated progress interface to match progressiveFeedbackService
import { ScriptChunk, ChunkFeedback, ChunkedScriptFeedback, Mentor, Character, TokenAwareRequest, TokenAwareResponse } from '../types';
import { aiFeedbackService } from './aiFeedbackService';
import { tokenService } from './tokenService';
import { getMentorFeedbackStyle } from '../data/mentors';
import { CharacterDataNormalizer } from '../utils/characterDataNormalizer';
import { backendApiService } from './backendApiService';

// FIXED: Updated progress interface to match ProcessingProgress from progressiveFeedbackService
export interface ChunkProcessingProgress {
  currentChunk: number;
  totalChunks: number;
  chunkTitle: string;
  progress: number; // 0-100
  message: string;
  // FIXED: Added missing properties to match ProcessingProgress
  isRetrying?: boolean;
  retryCount?: number;
  nextRetryIn?: number;
  completedChunks: ChunkFeedback[]; // FIXED: Added this property
  failedChunks: string[]; // FIXED: Added this property
  processingType?: 'chunked' | 'single' | 'blended'; // FIXED: Added this property
  mentorCount?: number; // FIXED: Added this property
  blendingMentors?: string[]; // FIXED: Added this property
  // Token information in progress updates
  tokensUsed?: number;
  remainingBalance?: number;
}

// NEW: Token-aware interfaces
interface ChunkedFeedbackRequest extends TokenAwareRequest {
  chunks: ScriptChunk[];
  mentor: Mentor;
  characters: Record<string, Character>;
  onProgress?: (progress: ChunkProcessingProgress) => void;
  abortSignal?: AbortSignal;
}

interface ChunkedFeedbackResponse extends TokenAwareResponse<ChunkedScriptFeedback> {
  feedback: ChunkedScriptFeedback;
}

export class FeedbackChunkService {
  /**
   * NEW: Token-aware chunked feedback generation
   * PRESERVED: All original functionality including batch processing and progress reporting
   * FIXED: Now properly initializes completedChunks and failedChunks arrays
   * IMPROVED: Better rate limit handling with exact wait times
   */
  async generateChunkedFeedback(request: ChunkedFeedbackRequest): Promise<ChunkedFeedbackResponse> {
  const { 
    userId, 
    chunks, 
    mentor, 
    characters, 
    actionType = 'chunked_feedback',
    scriptId,
    onProgress,
    abortSignal 
  } = request;

  // ADD DEBUG CODE HERE ↓
  console.log('🔍 DEBUG: Chunks received:', {
    chunks: chunks,
    chunksLength: chunks?.length,
    chunksType: typeof chunks,
    isArray: Array.isArray(chunks)
  });

  console.log('🧠 Starting chunked feedback generation with token validation via backend API:', {
    userId,
    mentor: mentor.name,
    chunkCount: chunks.length,
    strategy: chunks[0]?.chunkType || 'unknown',
    actionType
  });

    try {
      // NEW: Check for cancellation before token validation
      if (abortSignal?.aborted) {
        throw new Error('Chunked feedback generation cancelled before processing');
      }

      // NEW: Step 1 - Token validation and deduction
      const tokenResult = await tokenService.processTokenTransaction(
        userId,
        actionType,
        scriptId || chunks[0]?.id.split('_chunk_')[0] || 'unknown',
        mentor.id
      );

      if (!tokenResult.success) {
        const errorMessage = tokenResult.validation.hasEnoughTokens 
          ? 'Token deduction failed due to system error'
          : `Insufficient tokens for chunked feedback. Need ${tokenResult.validation.requiredTokens}, have ${tokenResult.validation.currentBalance}`;
        
        return {
          success: false,
          error: errorMessage,
          feedback: this.createEmptyChunkedFeedback(chunks, mentor),
          tokenInfo: {
            tokensUsed: 0,
            remainingBalance: tokenResult.validation.currentBalance,
            action: actionType
          }
        };
      }

      // NEW: Check for cancellation after token processing
      if (abortSignal?.aborted) {
        throw new Error('Chunked feedback generation cancelled after token processing');
      }

      // PRESERVED: Step 2 - Original chunked feedback generation logic
      const tokensUsed = tokenService.getTokenCost(actionType);
      const remainingBalance = tokenResult.validation.currentBalance;

      const result = await this.performOriginalChunkedFeedback({
        chunks,
        mentor,
        characters,
        onProgress: (progress) => {
          // FIXED: Ensure completedChunks and failedChunks are always defined
          const enhancedProgress: ChunkProcessingProgress = {
            ...progress,
            tokensUsed,
            remainingBalance,
            completedChunks: progress.completedChunks || [], // FIXED: Always provide array
            failedChunks: progress.failedChunks || [], // FIXED: Always provide array
            processingType: progress.processingType || 'chunked' // FIXED: Always provide type
          };
          
          onProgress?.(enhancedProgress);
        },
        abortSignal
      });

      return {
        success: true,
        feedback: result,
        data: result,
        tokenInfo: {
          tokensUsed,
          remainingBalance,
          action: actionType
        }
      };

    } catch (error: any) {
      console.error('❌ Chunked feedback generation failed:', error);
      
      // Handle cancellation vs other errors
      if (abortSignal?.aborted || error.message?.includes('cancelled')) {
        return {
          success: false,
          error: 'Chunked feedback generation cancelled by user',
          feedback: this.createEmptyChunkedFeedback(chunks, mentor),
          tokenInfo: {
            tokensUsed: 0,
            remainingBalance: 0,
            action: actionType
          }
        };
      }
      
      return {
        success: false,
        error: `Chunked feedback generation failed: ${error.message}`,
        feedback: this.createEmptyChunkedFeedback(chunks, mentor),
        tokenInfo: {
          tokensUsed: tokenService.getTokenCost(actionType),
          remainingBalance: 0, // We don't know the balance after failure
          action: actionType
        }
      };
    }
  }

  /**
   * PRESERVED: Original chunked feedback generation (without token integration)
   * Used internally after token validation
   * ALWAYS uses backend API via aiFeedbackService
   * FIXED: Now properly tracks completedChunks and failedChunks
   * IMPROVED: Better rate limit handling with exact wait times
   */
  private async performOriginalChunkedFeedback({
  chunks,
  mentor,
  characters,
  onProgress,
  abortSignal
}: {
  chunks: ScriptChunk[];
  mentor: Mentor;
  characters: Record<string, Character>;
  onProgress?: (progress: ChunkProcessingProgress) => void;
  abortSignal?: AbortSignal;
}): Promise<ChunkedScriptFeedback> {
  
  // FIXED: Add null checks for chunks
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    console.warn('⚠️ No chunks provided for feedback generation');
    return this.createEmptyChunkedFeedback([], mentor);
  }

  console.log('🔍 DEBUG: Inside performOriginalChunkedFeedback:', {
    chunksLength: chunks.length,
    firstChunk: chunks[0],
    mentor: mentor,
    characters: Object.keys(characters || {}),
    firstChunkCharacters: chunks[0]?.characters
  });

  const startTime = Date.now();
  const chunkFeedbacks: ChunkFeedback[] = [];
  // FIXED: Initialize arrays to track progress
  const completedChunks: ChunkFeedback[] = [];
  const failedChunks: string[] = [];
  
  // PRESERVED: Process chunks in parallel batches to avoid overwhelming the API
  const batchSize = 3; // Process 3 chunks at a time
  const batches = this.createBatches(chunks, batchSize);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
  // Check for cancellation between batches
  if (abortSignal?.aborted) {
    throw new Error('Chunked feedback generation cancelled during processing');
  }

  const batch = batches[batchIndex];
  
  // FIXED: Add null check for batch
  if (!batch || !Array.isArray(batch)) {
    console.warn('⚠️ Invalid batch encountered, skipping');
    continue;
  }

  console.log('🔍 DEBUG: Processing batch:', {
    batchIndex,
    batchLength: batch.length,
    batchContent: batch
  });
  
  // Process current batch
  const batchPromises = batch.map(async (chunk) => {
    if (!chunk) {
      console.warn('⚠️ Null chunk encountered, creating fallback');
      const fallback = this.createFallbackChunkFeedback({ id: 'unknown', title: 'Unknown', content: '', characters: [] }, mentor);
      failedChunks.push('unknown'); // FIXED: Track failed chunk
      return fallback;
    }

    const chunkIndex = chunks.indexOf(chunk);
    
    // FIXED: Update progress with proper arrays
    if (onProgress) {
      onProgress({
        currentChunk: chunkIndex + 1,
        totalChunks: chunks.length,
        chunkTitle: chunk?.title || 'Untitled Chunk',
        progress: Math.round((chunkIndex / chunks.length) * 100),
        message: `Analyzing ${chunk?.title || 'chunk'} via backend API...`,
        completedChunks: [...completedChunks], // FIXED: Always provide array
        failedChunks: [...failedChunks], // FIXED: Always provide array
        processingType: 'chunked' // FIXED: Always provide type
      });
    }

        try {
          const result = await this.generateChunkFeedbackViaBackend(chunk, mentor, characters, abortSignal);
          completedChunks.push(result); // FIXED: Track completed chunk
          return result;
        } catch (error) {
          console.error(`❌ Failed to generate feedback for ${chunk.title}:`, error);
          failedChunks.push(chunk.id); // FIXED: Track failed chunk
          // Return fallback feedback for failed chunks
          const fallback = this.createFallbackChunkFeedback(chunk, mentor);
          completedChunks.push(fallback); // FIXED: Still add to completed (as fallback)
          return fallback;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      chunkFeedbacks.push(...batchResults);
      
      // PRESERVED: Small delay between batches to be API-friendly
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Check for cancellation before summary generation
    if (abortSignal?.aborted) {
      throw new Error('Chunked feedback generation cancelled before summary');
    }

    // PRESERVED: Generate overall summary
    const summary = await this.generateOverallSummary(chunks, chunkFeedbacks, mentor);
    
    const processingTime = Date.now() - startTime;
    console.log('✅ Chunked feedback generation complete via backend API:', {
      mentor: mentor.name,
      chunksProcessed: chunkFeedbacks.length,
      processingTime: `${processingTime}ms`,
      averageTimePerChunk: `${Math.round(processingTime / chunks.length)}ms`
    });

    // FIXED: Final progress update with proper arrays
    if (onProgress) {
      onProgress({
        currentChunk: chunks.length,
        totalChunks: chunks.length,
        chunkTitle: 'Complete',
        progress: 100,
        message: 'Backend API analysis complete!',
        completedChunks: [...completedChunks], // FIXED: Always provide array
        failedChunks: [...failedChunks], // FIXED: Always provide array
        processingType: 'chunked' // FIXED: Always provide type
      });
    }

    return {
      id: `chunked_feedback_${Date.now()}`,
      scriptId: chunks[0]?.id.split('_chunk_')[0] || 'unknown',
      mentorId: mentor.id,
      chunks: chunkFeedbacks,
      summary,
      timestamp: new Date()
    };
  }

  /**
   * PRESERVED: Generate feedback for a single chunk using backend API via aiFeedbackService
   * ENHANCED: Now with cancellation support
   * IMPROVED: Better rate limit handling with exact wait times
   */
  private async generateChunkFeedbackViaBackend(
    chunk: ScriptChunk,
    mentor: Mentor,
    characters: Record<string, Character>,
    abortSignal?: AbortSignal
  ): Promise<ChunkFeedback> {
    console.log(`🎯 Generating feedback for ${chunk.title} via backend API...`);

    // Convert chunk to ScriptScene format for compatibility
    const chunkAsScene = {
      id: chunk.id,
      title: chunk.title,
      content: chunk.content,
      characters: chunk.characters
    };

    // Get chunk-specific characters
    const chunkCharacters = this.getChunkCharacters(chunk, characters);

    try {
      // IMPROVED: Add retry logic with exponential backoff
      let retryCount = 0;
      const maxRetries = 3;
      let lastError: Error | null = null;

      while (retryCount <= maxRetries) {
        try {
          // Check for cancellation before processing
          if (abortSignal?.aborted) {
            throw new Error('Chunk processing cancelled');
          }

          // Generate dual feedback using aiFeedbackService WITHOUT token deduction
          // (tokens already deducted for the entire chunked operation)
          const dualFeedback = await aiFeedbackService.performOriginalDualFeedback({
            scene: chunkAsScene,
            mentor,
            characters: chunkCharacters,
            abortSignal
          });

          return {
            chunkId: chunk.id,
            chunkTitle: chunk.title,
            structuredContent: dualFeedback.feedback.structuredContent || '',
            scratchpadContent: dualFeedback.feedback.scratchpadContent || '',
            mentorId: mentor.id,
            timestamp: new Date(),
            categories: dualFeedback.feedback.categories
          };
        } catch (error: any) {
          // Handle cancellation
          if (abortSignal?.aborted || error.message?.includes('cancelled')) {
            throw new Error('Chunk processing cancelled');
          }

          // Store the error for potential re-throw
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // Check for rate limit errors
          if (this.isRateLimitError(error)) {
            // IMPROVED: Extract exact wait time from error message
            const waitTimeMatch = error.toString().match(/try again in (\d+\.\d+)s/);
            let waitTime = Math.pow(2, retryCount) * 1000; // Default exponential backoff
            
            if (waitTimeMatch && waitTimeMatch[1]) {
              waitTime = parseFloat(waitTimeMatch[1]) * 1000 + 1000; // Convert to ms and add 1 second buffer
              console.log(`📊 Using exact wait time from API: ${waitTimeMatch[1]}s + 1s buffer`);
            }
            
            console.log(`🕒 Rate limit hit for chunk ${chunk.title}, waiting for ${waitTime/1000} seconds before retry...`);
            
            // Check if already aborted before waiting
            if (abortSignal?.aborted) {
              throw new Error('Chunk processing cancelled during rate limit wait');
            }
            
            // Wait for the specified time
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Increment retry count and try again
            retryCount++;
            continue;
          }
          
          // If we've reached max retries or it's not a rate limit error, throw
          if (retryCount >= maxRetries || !this.isRateLimitError(error)) {
            throw lastError;
          }
          
          // Otherwise, use exponential backoff
          const backoffTime = Math.pow(2, retryCount) * 1000;
          console.log(`⏱️ Retrying after ${backoffTime/1000} seconds (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          
          // Check if already aborted before waiting
          if (abortSignal?.aborted) {
            throw new Error('Chunk processing cancelled during backoff wait');
          }
          
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retryCount++;
        }
      }
      
      // If we've exhausted all retries, throw the last error
      if (lastError) {
        throw lastError;
      }
      
      // This should never be reached, but TypeScript requires a return
      throw new Error('Unexpected error in generateChunkFeedbackViaBackend');
    } catch (error) {
      console.error(`❌ Backend API chunk feedback generation failed for ${chunk.title}:`, error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  /**
   * PRESERVED: Get characters that appear in this chunk
   */
  private getChunkCharacters(
  chunk: ScriptChunk, 
  allCharacters: Record<string, Character>
): Record<string, Character> {
  const chunkCharacters: Record<string, Character> = {};
  
  // FIXED: Add null checks
  if (!chunk || !chunk.characters || !Array.isArray(chunk.characters)) {
    console.warn('⚠️ Invalid chunk or chunk.characters provided');
    return chunkCharacters;
  }

  if (!allCharacters || typeof allCharacters !== 'object') {
    console.warn('⚠️ Invalid allCharacters provided');
    return chunkCharacters;
  }
  
  chunk.characters.forEach(charName => {
    if (charName && allCharacters[charName]) {
      chunkCharacters[charName] = allCharacters[charName];
    }
  });

  return chunkCharacters;
}

  /**
   * PRESERVED: Create batches for parallel processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
  // FIXED: Add null checks
  if (!items || !Array.isArray(items) || items.length === 0) {
    console.warn('⚠️ Invalid items array provided to createBatches');
    return [];
  }

  if (batchSize <= 0) {
    console.warn('⚠️ Invalid batch size, using default of 1');
    batchSize = 1;
  }

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

  /**
   * PRESERVED: Generate an overall summary of the script based on chunk feedback
   */
  private async generateOverallSummary(
    chunks: ScriptChunk[],
    chunkFeedbacks: ChunkFeedback[],
    mentor: Mentor
  ): Promise<ChunkedScriptFeedback['summary']> {
    console.log('📋 Generating overall script summary...');

    // PRESERVED: Analyze patterns across chunks
    const structuralIssues = this.extractPatterns(chunkFeedbacks, 'structure');
    const dialogueIssues = this.extractPatterns(chunkFeedbacks, 'dialogue');
    const pacingIssues = this.extractPatterns(chunkFeedbacks, 'pacing');
    const themeIssues = this.extractPatterns(chunkFeedbacks, 'theme');

    // PRESERVED: Identify strengths and weaknesses
    const keyStrengths = this.identifyStrengths(chunkFeedbacks);
    const majorIssues = this.identifyMajorIssues(chunkFeedbacks);

    return {
      overallStructure: this.summarizeStructure(chunks, structuralIssues),
      keyStrengths,
      majorIssues,
      globalRecommendations: this.generateGlobalRecommendations(mentor, {
        structure: structuralIssues,
        dialogue: dialogueIssues,
        pacing: pacingIssues,
        theme: themeIssues
      })
    };
  }

  /**
   * PRESERVED: Extract common patterns from chunk feedback
   */
  private extractPatterns(chunkFeedbacks: ChunkFeedback[], category: keyof ChunkFeedback['categories']): string[] {
    const patterns = chunkFeedbacks
      .map(feedback => feedback.categories[category])
      .filter(Boolean)
      .reduce((acc, issue) => {
        // Simple keyword extraction
        const keywords = issue.toLowerCase().match(/\b\w{4,}\b/g) || [];
        keywords.forEach(keyword => {
          acc[keyword] = (acc[keyword] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>);

    // Return most common patterns
    return Object.entries(patterns)
      .filter(([_, count]) => count >= 2) // Appears in at least 2 chunks
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 3)
      .map(([pattern]) => pattern);
  }

  /**
   * PRESERVED: Identify script strengths
   */
  private identifyStrengths(chunkFeedbacks: ChunkFeedback[]): string[] {
    // Look for positive indicators in feedback
    const positiveWords = ['strong', 'effective', 'good', 'excellent', 'compelling', 'engaging'];
    const strengths: string[] = [];

    chunkFeedbacks.forEach(feedback => {
      const combinedContent = `${feedback.structuredContent} ${feedback.scratchpadContent}`.toLowerCase();
      positiveWords.forEach(word => {
        if (combinedContent.includes(word)) {
          // Extract context around positive words
          const index = combinedContent.indexOf(word);
          const context = combinedContent.substring(Math.max(0, index - 30), index + 50);
          if (context.includes('dialogue')) strengths.push('Strong dialogue throughout');
          if (context.includes('character')) strengths.push('Well-developed characters');
          if (context.includes('pacing')) strengths.push('Good pacing');
        }
      });
    });

    return [...new Set(strengths)].slice(0, 3);
  }

  /**
   * PRESERVED: Identify major issues
   */
  private identifyMajorIssues(chunkFeedbacks: ChunkFeedback[]): string[] {
    const issueWords = ['weak', 'unclear', 'confusing', 'slow', 'rushed', 'missing', 'needs work'];
    const issues: string[] = [];

    chunkFeedbacks.forEach(feedback => {
      const combinedContent = `${feedback.structuredContent} ${feedback.scratchpadContent}`.toLowerCase();
      issueWords.forEach(word => {
        if (combinedContent.includes(word)) {
          const index = combinedContent.indexOf(word);
          const context = combinedContent.substring(Math.max(0, index - 30), index + 50);
          if (context.includes('structure')) issues.push('Structural issues across multiple sections');
          if (context.includes('dialogue')) issues.push('Dialogue needs strengthening');
          if (context.includes('character')) issues.push('Character development inconsistencies');
        }
      });
    });

    return [...new Set(issues)].slice(0, 4);
  }

  /**
   * PRESERVED: Summarize overall structure
   */
  private summarizeStructure(chunks: ScriptChunk[], structuralIssues: string[]): string {
    const chunkType = chunks[0]?.chunkType || 'pages';
    const chunkCount = chunks.length;
    
    let structureSummary = `Script analyzed in ${chunkCount} ${chunkType}-based sections via backend API. `;
    
    if (structuralIssues.length > 0) {
      structureSummary += `Common structural elements to address: ${structuralIssues.join(', ')}.`;
    } else {
      structureSummary += 'Overall structure appears solid across sections.';
    }

    return structureSummary;
  }

  /**
   * PRESERVED: Generate global recommendations based on mentor style
   */
  private generateGlobalRecommendations(
    mentor: Mentor,
    patterns: Record<string, string[]>
  ): string[] {
    const recommendations: string[] = [];

    // PRESERVED: Mentor-specific global advice
    switch (mentor.id) {
      case 'tony-gilroy':
        recommendations.push('Focus on the story engine - what drives each section forward?');
        recommendations.push('Cut anything that doesn\'t serve the central narrative spine');
        if (patterns.pacing.length > 0) {
          recommendations.push('Start scenes later, end earlier - eliminate unnecessary setup');
        }
        break;
      
      case 'sofia-coppola':
        recommendations.push('Trust silences and subtext to carry emotional weight');
        recommendations.push('Use atmospheric details to reflect character psychology');
        if (patterns.dialogue.length > 0) {
          recommendations.push('Let characters communicate through behavior, not just words');
        }
        break;
      
      case 'vince-gilligan':
        recommendations.push('Ground every character choice in psychological truth');
        recommendations.push('Build moral complexity into character decisions');
        if (patterns.structure.length > 0) {
          recommendations.push('Show how character flaws create their own problems');
        }
        break;
      
      default:
        recommendations.push('Strengthen character objectives throughout');
        recommendations.push('Enhance conflict and stakes in each section');
        recommendations.push('Improve dialogue efficiency and purpose');
        break;
    }

    return recommendations.slice(0, 3);
  }

  /**
   * PRESERVED: Create fallback feedback for failed chunks
   */
  private createFallbackChunkFeedback(chunk: ScriptChunk, mentor: Mentor): ChunkFeedback {
  return {
    chunkId: chunk?.id || 'unknown_chunk',
    chunkTitle: chunk?.title || 'Unknown Chunk',
    structuredContent: `## ${mentor?.name || 'Unknown Mentor'} Analysis - ${chunk?.title || 'Unknown Chunk'}\n\n### Analysis Pending\n• This section requires detailed backend API analysis\n• Please retry for comprehensive feedback\n\n"${mentor?.mantra || 'Every word must earn its place on the page.'}"`,
    scratchpadContent: `## ${mentor?.name || 'Unknown Mentor'} Notes - ${chunk?.title || 'Unknown Chunk'}\n\n### Initial Observation\n• Section needs full backend API analysis for specific insights\n• Contains ${chunk?.content?.length || 0} characters of content\n\n### Next Steps\n• Retry analysis for detailed feedback\n\n"${mentor?.mantra || 'Every word must earn its place on the page.'}"`,
    mentorId: mentor?.id || 'unknown',
    timestamp: new Date(),
    categories: {
      structure: 'Requires backend API analysis',
      dialogue: 'Requires backend API analysis', 
      pacing: 'Requires backend API analysis',
      theme: 'Requires backend API analysis'
    }
  };
}

  /**
   * NEW: Create empty chunked feedback for error cases
   */
  private createEmptyChunkedFeedback(chunks: ScriptChunk[], mentor: Mentor): ChunkedScriptFeedback {
  // FIXED: Add null checks
  const safeChunks = chunks || [];
  const emptyChunks: ChunkFeedback[] = safeChunks.map(chunk => ({
    chunkId: chunk?.id || 'unknown',
    chunkTitle: chunk?.title || 'Unknown Chunk',
    structuredContent: 'Feedback generation failed. Please try again.',
    scratchpadContent: 'Unable to generate feedback at this time.',
    mentorId: mentor?.id || 'unknown',
    timestamp: new Date(),
    categories: {
      structure: 'Error',
      dialogue: 'Error',
      pacing: 'Error',
      theme: 'Error'
    }
  }));

  return {
    id: `error_chunked_feedback_${Date.now()}`,
    scriptId: safeChunks[0]?.id.split('_chunk_')[0] || 'unknown',
    mentorId: mentor?.id || 'unknown',
    chunks: emptyChunks,
    summary: {
      overallStructure: 'Feedback generation failed',
      keyStrengths: [],
      majorIssues: ['System error prevented analysis'],
      globalRecommendations: ['Please try again later']
    },
    timestamp: new Date()
  };
}

  /**
   * NEW: Validate tokens before chunked feedback processing (public method)
   */
  async validateTokensForChunkedFeedback(userId: string): Promise<{
    canProceed: boolean;
    cost: number;
    currentBalance: number;
    shortfall?: number;
  }> {
    try {
      const cost = tokenService.getTokenCost('chunked_feedback');
      const validation = await tokenService.validateTokenBalance(userId, cost);
      
      return {
        canProceed: validation.hasEnoughTokens,
        cost,
        currentBalance: validation.currentBalance,
        shortfall: validation.shortfall
      };
    } catch (error) {
      console.error('Error validating tokens for chunked feedback:', error);
      return {
        canProceed: false,
        cost: tokenService.getTokenCost('chunked_feedback'),
        currentBalance: 0
      };
    }
  }

  /**
   * NEW: Get token cost for chunked feedback (public method)
   */
  getTokenCost(): number {
    return tokenService.getTokenCost('chunked_feedback');
  }

  /**
   * PRESERVED: Legacy method for backward compatibility (without token integration)
   */
  async generateChunkedFeedbackLegacy(
    chunks: ScriptChunk[],
    mentor: Mentor,
    characters: Record<string, Character>,
    onProgress?: (progress: ChunkProcessingProgress) => void
  ): Promise<ChunkedScriptFeedback> {
    console.log('🔄 Legacy chunked feedback generation requested');
    
    return this.performOriginalChunkedFeedback({
      chunks,
      mentor,
      characters,
      onProgress
    });
  }

  /**
   * IMPROVED: Check if error is rate limit related with better detection
   */
  private isRateLimitError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorString = error?.toString?.()?.toLowerCase() || '';
    
    return errorMessage.includes('rate limit') || 
           errorMessage.includes('too many requests') ||
           errorMessage.includes('quota exceeded') ||
           errorMessage.includes('try again in') ||
           errorMessage.includes('429') ||
           errorString.includes('rate limit') ||
           errorString.includes('429') ||
           errorString.includes('try again in');
  }
}

// Export singleton instance
export const feedbackChunkService = new FeedbackChunkService();