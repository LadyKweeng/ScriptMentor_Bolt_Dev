// src/services/progressiveFeedbackService.ts
import { ScriptChunk, ChunkFeedback, ChunkedScriptFeedback, Mentor, Character, ScriptScene, Feedback, MentorWeights } from '../types';
import { aiFeedbackService } from './aiFeedbackService';
import { FeedbackGenerator } from '../utils/feedbackGenerator';
import { CharacterMemoryManager } from '../utils/characterMemory';

export interface ProcessingProgress {
  currentChunk: number;
  totalChunks: number;
  chunkTitle: string;
  progress: number;
  message: string;
  isRetrying?: boolean;
  retryCount?: number;
  nextRetryIn?: number;
  completedChunks: ChunkFeedback[];
  failedChunks: string[];
  processingType?: 'chunked' | 'single' | 'blended';
  mentorCount?: number;
  blendingMentors?: string[];
}

export interface ProgressiveProcessingOptions {
  maxConcurrent: number;
  retryAttempts: number;
  baseDelay: number;
  exponentialBackoff: boolean;
  showPartialResults: boolean;
  processingType?: 'chunked' | 'single' | 'blended';
}

export class ProgressiveFeedbackService {
  private defaultOptions: ProgressiveProcessingOptions = {
    maxConcurrent: 1, // Process one at a time to avoid rate limits
    retryAttempts: 3,
    baseDelay: 2000, // 2 seconds base delay
    exponentialBackoff: true,
    showPartialResults: true,
    processingType: 'chunked'
  };

  private feedbackGenerator: FeedbackGenerator;

  constructor() {
    // Initialize with empty character manager - will be updated per call
    this.feedbackGenerator = new FeedbackGenerator(new CharacterMemoryManager({}));
  }

  /**
   * UNIFIED PROCESSING METHOD: Handles chunked, single scene, and blended feedback
   * Uses the same progressive UI for all feedback types
   */
  async processChunksProgressively(
    chunks: ScriptChunk[],
    mentor: Mentor,
    characters: Record<string, Character>,
    onProgress: (progress: ProcessingProgress) => void,
    options: Partial<ProgressiveProcessingOptions> = {}
  ): Promise<ChunkedScriptFeedback> {
    const config = { ...this.defaultOptions, ...options };
    const completedChunks: ChunkFeedback[] = [];
    const failedChunks: string[] = [];
    
    // Determine processing type based on chunks and mentor
    const processingType = this.determineProcessingType(chunks, mentor, config);
    
    console.log('🚀 Starting unified progressive feedback processing...', {
      mentor: mentor.name,
      chunkCount: chunks.length,
      processingType,
      config
    });

    // Update character manager for this processing session
    this.feedbackGenerator = new FeedbackGenerator(new CharacterMemoryManager(characters));

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let success = false;
      let retryCount = 0;
      let lastError: any = null;

      while (!success && retryCount <= config.retryAttempts) {
        try {
          // Update progress with processing type specific messaging
          const progressMessage = this.generateProgressMessage(chunk, retryCount, processingType, mentor);
          
          onProgress({
            currentChunk: i + 1,
            totalChunks: chunks.length,
            chunkTitle: chunk.title,
            progress: Math.round((i / chunks.length) * 100),
            message: progressMessage,
            isRetrying: retryCount > 0,
            retryCount,
            completedChunks: [...completedChunks],
            failedChunks: [...failedChunks],
            processingType,
            mentorCount: processingType === 'blended' ? 1 : undefined, // Will be enhanced for true blending
            blendingMentors: processingType === 'blended' ? [mentor.name] : undefined
          });

          // Process chunk based on type
          let chunkFeedback: ChunkFeedback;

          if (processingType === 'blended') {
            chunkFeedback = await this.processBlendedChunk(chunk, mentor, characters, retryCount);
          } else if (processingType === 'single') {
            chunkFeedback = await this.processSingleSceneChunk(chunk, mentor, characters, retryCount);
          } else {
            chunkFeedback = await this.processChunkWithRateLimit(chunk, mentor, characters, retryCount);
          }
          
          completedChunks.push(chunkFeedback);
          success = true;

          console.log(`✅ ${processingType} chunk processed: ${chunk.title} (attempt ${retryCount + 1})`);

          // Add delay between chunks to respect rate limits
          if (i < chunks.length - 1) {
            const delay = this.calculateDelay(retryCount, config);
            await this.sleep(delay);
          }

        } catch (error: any) {
          lastError = error;
          retryCount++;

          if (this.isRateLimitError(error)) {
            console.log(`🚨 Rate limit hit for ${chunk.title} (attempt ${retryCount}/${config.retryAttempts + 1})`);
            
            if (retryCount <= config.retryAttempts) {
              const retryDelay = this.calculateRetryDelay(retryCount, config);
              
              onProgress({
                currentChunk: i + 1,
                totalChunks: chunks.length,
                chunkTitle: chunk.title,
                progress: Math.round((i / chunks.length) * 100),
                message: `Rate limit hit - retrying in ${Math.round(retryDelay / 1000)}s...`,
                isRetrying: true,
                retryCount,
                nextRetryIn: retryDelay,
                completedChunks: [...completedChunks],
                failedChunks: [...failedChunks],
                processingType
              });

              await this.sleep(retryDelay);
            }
          } else {
            console.error(`❌ Non-rate-limit error for ${chunk.title}:`, error);
            break; // Don't retry non-rate-limit errors
          }
        }
      }

      // If chunk failed after all retries, create fallback feedback
      if (!success) {
        console.warn(`⚠️ Creating fallback feedback for failed chunk: ${chunk.title}`);
        const fallbackFeedback = this.createFallbackChunkFeedback(chunk, mentor, lastError, retryCount - 1);
        completedChunks.push(fallbackFeedback);
        failedChunks.push(chunk.id);
      }
    }

    // Generate final summary
    const summary = await this.generateProgressiveSummary(chunks, completedChunks, mentor, processingType);

    // Calculate final statistics
    const realSuccessfulChunks = completedChunks.filter(chunk => 
      !(chunk as any).processingError
    ).length;
    
    const rateLimitedChunks = completedChunks.filter(chunk => 
      (chunk as any).processingError === 'rate limit'
    ).length;

    // Final progress update
    onProgress({
      currentChunk: chunks.length,
      totalChunks: chunks.length,
      chunkTitle: 'Complete',
      progress: 100,
      message: this.generateFinalMessage(realSuccessfulChunks, chunks.length, rateLimitedChunks, processingType),
      completedChunks,
      failedChunks,
      processingType
    });

    return {
      id: `progressive_feedback_${Date.now()}`,
      scriptId: chunks[0]?.id.split('_chunk_')[0] || 'unknown',
      mentorId: mentor.id,
      chunks: completedChunks,
      summary,
      timestamp: new Date(),
      processingStats: {
        totalChunks: chunks.length,
        successfulChunks: realSuccessfulChunks,
        rateLimitedChunks: rateLimitedChunks,
        permanentlyFailedChunks: failedChunks.length,
        totalRetryAttempts: completedChunks.reduce((sum, chunk) => 
          sum + ((chunk as any).retryCount || 0), 0),
        processingType
      }
    };
  }

  /**
   * Enhanced method for processing true blended feedback from multiple mentors
   */
  async processBlendedFeedback(
    chunks: ScriptChunk[],
    mentors: Mentor[],
    mentorWeights: MentorWeights,
    characters: Record<string, Character>,
    onProgress: (progress: ProcessingProgress) => void,
    options: Partial<ProgressiveProcessingOptions> = {}
  ): Promise<ChunkedScriptFeedback> {
    const config = { ...this.defaultOptions, ...options, processingType: 'blended' as const };
    const completedChunks: ChunkFeedback[] = [];
    const failedChunks: string[] = [];
    
    console.log('🔀 Starting true blended mentor feedback processing...', {
      mentors: mentors.map(m => m.name),
      chunkCount: chunks.length,
      weights: mentorWeights
    });

    // Update character manager
    this.feedbackGenerator = new FeedbackGenerator(new CharacterMemoryManager(characters));

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let success = false;
      let retryCount = 0;
      let lastError: any = null;

      while (!success && retryCount <= config.retryAttempts) {
        try {
          onProgress({
            currentChunk: i + 1,
            totalChunks: chunks.length,
            chunkTitle: chunk.title,
            progress: Math.round((i / chunks.length) * 100),
            message: retryCount > 0 
              ? `Retrying blended analysis for ${chunk.title} (attempt ${retryCount + 1})`
              : `Blending insights from ${mentors.length} mentors for ${chunk.title}`,
            isRetrying: retryCount > 0,
            retryCount,
            completedChunks: [...completedChunks],
            failedChunks: [...failedChunks],
            processingType: 'blended',
            mentorCount: mentors.length,
            blendingMentors: mentors.map(m => m.name)
          });

          // Convert chunk to scene for blending
          const chunkAsScene: ScriptScene = {
            id: chunk.id,
            title: chunk.title,
            content: chunk.content,
            characters: chunk.characters
          };

          // Generate blended feedback using existing blendFeedback method
          const blendedFeedback = await this.feedbackGenerator.blendFeedback(
            chunkAsScene,
            mentors,
            mentorWeights
          );

          // Convert blended feedback to chunk format
          const chunkFeedback: ChunkFeedback = {
            chunkId: chunk.id,
            chunkTitle: chunk.title,
            structuredContent: blendedFeedback.structuredContent || '',
            scratchpadContent: blendedFeedback.scratchpadContent || '',
            mentorId: 'blended',
            timestamp: new Date(),
            categories: blendedFeedback.categories || {
              structure: 'Blended analysis',
              dialogue: 'Blended analysis',
              pacing: 'Blended analysis',
              theme: 'Blended analysis'
            },
            retryCount
          } as ChunkFeedback & { retryCount: number };

          completedChunks.push(chunkFeedback);
          success = true;

          console.log(`✅ Blended chunk processed: ${chunk.title} from ${mentors.length} mentors`);

          // Longer delay for blended processing
          if (i < chunks.length - 1) {
            await this.sleep(config.baseDelay * 1.5);
          }

        } catch (error: any) {
          lastError = error;
          retryCount++;

          if (retryCount <= config.retryAttempts) {
            const retryDelay = this.calculateRetryDelay(retryCount, config);
            await this.sleep(retryDelay);
          }
        }
      }

      if (!success) {
        const fallbackFeedback = this.createBlendedFallbackFeedback(chunk, mentors, lastError, retryCount - 1);
        completedChunks.push(fallbackFeedback);
        failedChunks.push(chunk.id);
      }
    }

    // Generate blended summary
    const summary = await this.generateBlendedSummary(chunks, completedChunks, mentors);

    const realSuccessfulChunks = completedChunks.filter(chunk => 
      !(chunk as any).processingError
    ).length;

    onProgress({
      currentChunk: chunks.length,
      totalChunks: chunks.length,
      chunkTitle: 'Complete',
      progress: 100,
      message: `Blended analysis complete! ${realSuccessfulChunks}/${chunks.length} sections analyzed from ${mentors.length} mentors`,
      completedChunks,
      failedChunks,
      processingType: 'blended',
      mentorCount: mentors.length,
      blendingMentors: mentors.map(m => m.name)
    });

    return {
      id: `blended_feedback_${Date.now()}`,
      scriptId: chunks[0]?.id.split('_chunk_')[0] || 'unknown',
      mentorId: 'blended',
      chunks: completedChunks,
      summary,
      timestamp: new Date(),
      processingStats: {
        totalChunks: chunks.length,
        successfulChunks: realSuccessfulChunks,
        rateLimitedChunks: 0,
        permanentlyFailedChunks: failedChunks.length,
        totalRetryAttempts: completedChunks.reduce((sum, chunk) => 
          sum + ((chunk as any).retryCount || 0), 0),
        processingType: 'blended',
        mentorCount: mentors.length
      }
    };
  }

  /**
   * Determine processing type based on input parameters
   */
  private determineProcessingType(
    chunks: ScriptChunk[], 
    mentor: Mentor, 
    config: ProgressiveProcessingOptions
  ): 'chunked' | 'single' | 'blended' {
    if (config.processingType) {
      return config.processingType;
    }
    
    if (mentor.id === 'blended') {
      return 'blended';
    }
    
    if (chunks.length === 1 && chunks[0].chunkType === 'scene') {
      return 'single';
    }
    
    return 'chunked';
  }

  /**
   * Generate processing type specific progress messages
   */
  private generateProgressMessage(
    chunk: ScriptChunk, 
    retryCount: number, 
    processingType: 'chunked' | 'single' | 'blended',
    mentor: Mentor
  ): string {
    const baseTitle = chunk.title || 'Section';
    const retryText = retryCount > 0 ? ` (retry ${retryCount})` : '';

    switch (processingType) {
      case 'single':
        return retryCount > 0 
          ? `Retrying ${mentor.name} analysis for scene${retryText}`
          : `Analyzing scene with ${mentor.name}'s expertise`;
      
      case 'blended':
        return retryCount > 0
          ? `Retrying blended mentor analysis for ${baseTitle}${retryText}`
          : `Blending mentor perspectives for ${baseTitle}`;
      
      case 'chunked':
      default:
        return retryCount > 0
          ? `Retrying ${mentor.name} analysis for ${baseTitle}${retryText}`
          : `Analyzing ${baseTitle} with ${mentor.name}`;
    }
  }

  /**
   * Generate final completion messages
   */
  private generateFinalMessage(
    successfulChunks: number,
    totalChunks: number,
    rateLimitedChunks: number,
    processingType: 'chunked' | 'single' | 'blended'
  ): string {
    const baseMessage = `Analysis complete! ${successfulChunks}/${totalChunks}`;
    const rateLimitText = rateLimitedChunks > 0 ? `, ${rateLimitedChunks} used fallback due to rate limits` : '';

    switch (processingType) {
      case 'single':
        return `${baseMessage} scene analyzed with AI feedback${rateLimitText}`;
      
      case 'blended':
        return `${baseMessage} sections analyzed with blended mentor insights${rateLimitText}`;
      
      case 'chunked':
      default:
        return `${baseMessage} chunks with AI feedback${rateLimitText}`;
    }
  }

  /**
   * Process a single chunk with intelligent rate limit handling
   */
  private async processChunkWithRateLimit(
    chunk: ScriptChunk,
    mentor: Mentor,
    characters: Record<string, Character>,
    retryCount: number = 0
  ): Promise<ChunkFeedback> {
    console.log(`🎯 Processing chunk: ${chunk.title} (attempt ${retryCount + 1})`);

    // Convert chunk to scene format
    const chunkAsScene = {
      id: chunk.id,
      title: chunk.title,
      content: chunk.content,
      characters: chunk.characters
    };

    // Get chunk-specific characters
    const chunkCharacters = this.getChunkCharacters(chunk, characters);

    try {
      // Use existing AI feedback service but bypass its fallback logic
      const dualFeedback = await this.generateFeedbackWithoutFallback(
        chunkAsScene,
        mentor,
        chunkCharacters
      );

      return {
        chunkId: chunk.id,
        chunkTitle: chunk.title,
        structuredContent: dualFeedback.structuredContent || '',
        scratchpadContent: dualFeedback.scratchpadContent || '',
        mentorId: mentor.id,
        timestamp: new Date(),
        categories: dualFeedback.categories || {
          structure: 'Analyzed',
          dialogue: 'Analyzed',
          pacing: 'Analyzed',
          theme: 'Analyzed'
        },
        retryCount
      } as ChunkFeedback & { retryCount: number };

    } catch (error: any) {
      // Enhanced error detection and re-throw for retry logic
      if (this.isRateLimitError(error)) {
        console.log(`🚨 Rate limit detected for ${chunk.title}:`, error.message);
        throw new Error(`RATE_LIMIT: ${error.message}`);
      } else if (this.isTokenLimitError(error)) {
        throw new Error(`TOKEN_LIMIT: ${error.message}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Process single scene chunk with enhanced messaging
   */
  private async processSingleSceneChunk(
    chunk: ScriptChunk,
    mentor: Mentor,
    characters: Record<string, Character>,
    retryCount: number = 0
  ): Promise<ChunkFeedback> {
    console.log(`🎭 Processing single scene: ${chunk.title} with ${mentor.name} (attempt ${retryCount + 1})`);

    // Use existing feedback generator for single scene
    const sceneAsScene: ScriptScene = {
      id: chunk.id,
      title: chunk.title,
      content: chunk.content,
      characters: chunk.characters
    };

    try {
      const dualFeedback = await this.feedbackGenerator.generateDualFeedback(sceneAsScene, mentor);

      return {
        chunkId: chunk.id,
        chunkTitle: chunk.title,
        structuredContent: dualFeedback.structuredContent || '',
        scratchpadContent: dualFeedback.scratchpadContent || '',
        mentorId: mentor.id,
        timestamp: new Date(),
        categories: dualFeedback.categories || {
          structure: 'Analyzed',
          dialogue: 'Analyzed',
          pacing: 'Analyzed',
          theme: 'Analyzed'
        },
        retryCount
      } as ChunkFeedback & { retryCount: number };

    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        throw new Error(`RATE_LIMIT: ${error.message}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Process blended chunk
   */
  private async processBlendedChunk(
    chunk: ScriptChunk,
    blendedMentor: Mentor, // This is the blended mentor object
    characters: Record<string, Character>,
    retryCount: number = 0
  ): Promise<ChunkFeedback> {
    console.log(`🔀 Processing blended chunk: ${chunk.title} (attempt ${retryCount + 1})`);

    // For now, use the feedbackGenerator with the blended mentor
    // In future versions, this could be enhanced to actually blend multiple mentors
    const sceneAsScene: ScriptScene = {
      id: chunk.id,
      title: chunk.title,
      content: chunk.content,
      characters: chunk.characters
    };

    try {
      const dualFeedback = await this.feedbackGenerator.generateDualFeedback(sceneAsScene, blendedMentor);

      return {
        chunkId: chunk.id,
        chunkTitle: chunk.title,
        structuredContent: dualFeedback.structuredContent || '',
        scratchpadContent: dualFeedback.scratchpadContent || '',
        mentorId: 'blended',
        timestamp: new Date(),
        categories: dualFeedback.categories || {
          structure: 'Blended analysis',
          dialogue: 'Blended analysis',
          pacing: 'Blended analysis',
          theme: 'Blended analysis'
        },
        retryCount
      } as ChunkFeedback & { retryCount: number };

    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        throw new Error(`RATE_LIMIT: ${error.message}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Generate feedback without falling back to mock content
   */
  private async generateFeedbackWithoutFallback(
    scene: any,
    mentor: Mentor,
    characters: Record<string, Character>
  ): Promise<{ structuredContent: string; scratchpadContent: string; categories: any }> {
    // Import the backend service directly to bypass aiFeedbackService fallback logic
    const { backendApiService } = await import('./backendApiService');
    const { CharacterDataNormalizer } = await import('../utils/characterDataNormalizer');
    const { getMentorFeedbackStyle } = await import('../data/mentors');

    // Build character context
    const characterContext = CharacterDataNormalizer.createCharacterContext(characters);
    
    // Get mentor-specific feedback style
    const feedbackStyle = getMentorFeedbackStyle(mentor);
    
    // Generate both types of feedback in parallel
    const [structuredContent, scratchpadContent] = await Promise.all([
      backendApiService.generateFeedback({
        scene_content: scene.content,
        mentor_id: mentor.id,
        character_context: characterContext,
        feedback_mode: 'structured',
        system_prompt: feedbackStyle.systemPrompt,
        temperature: feedbackStyle.temperature
      }),
      backendApiService.generateFeedback({
        scene_content: scene.content,
        mentor_id: mentor.id,
        character_context: characterContext,
        feedback_mode: 'scratchpad',
        system_prompt: feedbackStyle.systemPrompt,
        temperature: feedbackStyle.temperature
      })
    ]);

    // Extract categories from structured content
    const categories = this.extractCategoriesFromFeedback(structuredContent);

    return {
      structuredContent: this.cleanFeedbackContent(structuredContent, mentor),
      scratchpadContent: this.cleanFeedbackContent(scratchpadContent, mentor),
      categories
    };
  }

  /**
   * Extract categories from feedback text
   */
  private extractCategoriesFromFeedback(text: string): any {
    return {
      structure: text.includes('Structure') ? 'Analyzed' : 'Review needed',
      dialogue: text.includes('Dialogue') ? 'Analyzed' : 'Review needed',
      pacing: text.includes('Pacing') ? 'Analyzed' : 'Review needed',
      theme: text.includes('Theme') ? 'Analyzed' : 'Review needed'
    };
  }

  /**
   * Clean feedback content for display
   */
  private cleanFeedbackContent(content: string, mentor: Mentor): string {
    // Remove any extra formatting and ensure mentor voice
    return content.trim();
  }

  /**
   * Get characters specific to this chunk
   */
  private getChunkCharacters(chunk: ScriptChunk, allCharacters: Record<string, Character>): Record<string, Character> {
    const chunkCharacters: Record<string, Character> = {};
    
    chunk.characters.forEach(charName => {
      if (allCharacters[charName]) {
        chunkCharacters[charName] = allCharacters[charName];
      }
    });
    
    return chunkCharacters;
  }

  /**
   * Check if error is rate limit related
   */
  private isRateLimitError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorString = error?.toString?.()?.toLowerCase() || '';
    
    return errorMessage.includes('rate limit') || 
           errorMessage.includes('too many requests') ||
           errorMessage.includes('quota exceeded') ||
           errorString.includes('rate limit') ||
           errorString.includes('429');
  }

  /**
   * Check if error is token limit related
   */
  private isTokenLimitError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return errorMessage.includes('token limit') || 
           errorMessage.includes('context length') ||
           errorMessage.includes('maximum context');
  }

  /**
   * Calculate delay between chunks
   */
  private calculateDelay(retryCount: number, config: ProgressiveProcessingOptions): number {
    return config.baseDelay + (retryCount * 1000);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number, config: ProgressiveProcessingOptions): number {
    if (config.exponentialBackoff) {
      return config.baseDelay * Math.pow(2, retryCount - 1);
    }
    return config.baseDelay * retryCount;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create fallback chunk feedback for failed processing
   */
  private createFallbackChunkFeedback(
    chunk: ScriptChunk,
    mentor: Mentor,
    error: any,
    retryCount: number
  ): ChunkFeedback & { processingError: string; errorDetails: string } {
    const isRateLimit = this.isRateLimitError(error);
    const isTokenLimit = this.isTokenLimitError(error);
    const errorType = isRateLimit ? 'rate limit' : isTokenLimit ? 'token limit' : 'processing error';
    const errorMessage = error?.message || 'Unknown error occurred';

    return {
      chunkId: chunk.id,
      chunkTitle: chunk.title,
      structuredContent: `## ${mentor.name} Analysis - ${chunk.title}\n\n### Processing Issue\n• ${errorMessage}\n• Section contains ${Math.round(chunk.content.length / 250)} estimated minutes of content\n• Characters present: ${chunk.characters.join(', ')}\n\n### What We Know\n• ${chunk.characters.length} characters interact in this section\n• Content appears ${chunk.content.length > 2000 ? 'substantial and complex' : 'focused and concise'}\n• Section is part of larger ${chunk.content.length > 15000 ? 'major sequence' : 'story beat'}\n\n### Recommendation\n• ${isRateLimit ? 'Retry processing during off-peak hours when API limits are less restrictive' : isTokenLimit ? 'Consider breaking this section into smaller parts' : 'Manual review recommended for this section'}\n• Section contains substantial content that warrants detailed analysis\n\n### Manual Review Suggested\n• This section deserves ${mentor.name}'s full analytical attention\n• Consider the key dramatic elements and character dynamics present\n\n"${mentor.mantra || 'Every word must earn its place on the page.'}"`,
      scratchpadContent: `## ${mentor.name} Notes - ${chunk.title}\n\n### Processing Issue\n• ${errorMessage}\n• Section contains ${Math.round(chunk.content.length / 250)} estimated minutes of content\n• Characters present: ${chunk.characters.join(', ')}\n\n### What We Know\n• ${chunk.characters.length} characters interact in this section\n• Content appears ${chunk.content.length > 2000 ? 'substantial and complex' : 'focused and concise'}\n• Section is part of larger ${chunk.content.length > 15000 ? 'major sequence' : 'story beat'}\n\n### Next Steps\n• ${isRateLimit ? 'Worth retrying when API capacity allows' : 'Manual analysis recommended'}\n• Section merits detailed ${mentor.name}-style examination\n\n"${mentor.mantra || 'Every word must earn its place on the page.'}"`,
      mentorId: mentor.id,
      timestamp: new Date(),
      categories: {
        structure: `${errorType} - manual review needed`,
        dialogue: `${errorType} - manual review needed`,
        pacing: `${errorType} - manual review needed`,
        theme: `${errorType} - manual review needed`
      },
      processingError: errorType,
      errorDetails: errorMessage
    } as ChunkFeedback & { processingError: string; errorDetails: string };
  }

  /**
   * Create fallback feedback for blended processing
   */
  private createBlendedFallbackFeedback(
    chunk: ScriptChunk,
    mentors: Mentor[],
    error: any,
    retryCount: number
  ): ChunkFeedback & { processingError: string; errorDetails: string } {
    const errorMessage = error?.message || 'Blended processing failed';
    const mentorNames = mentors.map(m => m.name).join(', ');

    return {
      chunkId: chunk.id,
      chunkTitle: chunk.title,
      structuredContent: `## Blended Analysis - ${chunk.title}\n\n### Processing Issue\n• Failed to blend insights from: ${mentorNames}\n• ${errorMessage}\n• Section contains valuable content that merits multi-perspective analysis\n\n### Manual Review Recommended\n• Consider analyzing this section with individual mentors\n• Each mentor's unique perspective would benefit this content\n• Rich material deserves comprehensive analysis\n\n"Multiple perspectives reveal the full picture."`,
      scratchpadContent: `## Blended Notes - ${chunk.title}\n\n### Processing Challenge\n• Could not complete blended analysis from ${mentors.length} mentors\n• ${errorMessage}\n• Section shows promise for multi-perspective insights\n\n### Alternative Approach\n• Try individual mentor analysis\n• Each perspective offers unique value\n• Content warrants detailed examination\n\n"Every script benefits from multiple viewpoints."`,
      mentorId: 'blended',
      timestamp: new Date(),
      categories: {
        structure: 'blending failed - manual review needed',
        dialogue: 'blending failed - manual review needed',
        pacing: 'blending failed - manual review needed',
        theme: 'blending failed - manual review needed'
      },
      processingError: 'blending failed',
      errorDetails: errorMessage
    } as ChunkFeedback & { processingError: string; errorDetails: string };
  }

  /**
   * Generate progressive summary as chunks complete
   */
  private async generateProgressiveSummary(
    chunks: ScriptChunk[],
    completedChunks: ChunkFeedback[],
    mentor: Mentor,
    processingType: 'chunked' | 'single' | 'blended'
  ): Promise<ChunkedScriptFeedback['summary']> {
    console.log('📋 Generating progressive summary...', { processingType });

    const successfulChunks = completedChunks.filter(chunk => 
      !(chunk as any).processingError
    );

    const rateLimitedChunks = completedChunks.filter(chunk => 
      (chunk as any).processingError === 'rate limit'
    );

    const otherFailedChunks = completedChunks.filter(chunk => 
      (chunk as any).processingError && (chunk as any).processingError !== 'rate limit'
    );

    const successRate = Math.round((successfulChunks.length / chunks.length) * 100);
    const typeLabel = processingType === 'single' ? 'scene' : processingType === 'blended' ? 'blended sections' : 'sections';

    return {
      overallStructure: `Script processed in ${chunks.length} ${typeLabel} with ${successRate}% AI analysis success rate. ${successfulChunks.length} ${typeLabel} received full ${mentor.name} feedback${rateLimitedChunks.length > 0 ? `, ${rateLimitedChunks.length} ${typeLabel} hit API rate limits` : ''}${otherFailedChunks.length > 0 ? `, ${otherFailedChunks.length} ${typeLabel} had processing issues` : ''}.`,
      
      keyStrengths: successfulChunks.length > 0 ? [
        `${successfulChunks.length} ${typeLabel} analyzed with AI-powered ${mentor.name} feedback`,
        processingType === 'blended' ? 'Multi-perspective analysis provides comprehensive insights' : `${mentor.name}'s expertise applied systematically`,
        'Progressive processing allows for real-time review of completed sections'
      ] : ['Partial processing completed - manual review recommended'],

      majorIssues: [
        ...(rateLimitedChunks.length > 0 ? [`${rateLimitedChunks.length} ${typeLabel} hit API rate limits and used fallback analysis`] : []),
        ...(otherFailedChunks.length > 0 ? [`${otherFailedChunks.length} ${typeLabel} encountered processing issues and need manual review`] : []),
        ...(successfulChunks.length === 0 ? ['All sections encountered processing issues - manual analysis recommended'] : [])
      ],

      globalRecommendations: [
        ...(successfulChunks.length > 0 ? ['Review completed AI analysis for specific script improvements'] : []),
        ...(rateLimitedChunks.length > 0 ? ['Retry rate-limited sections during off-peak hours for full AI analysis'] : []),
        ...(otherFailedChunks.length > 0 ? ['Manual analysis recommended for sections that encountered processing issues'] : []),
        processingType === 'single' ? 'Consider chunking longer scripts for more detailed analysis' : 'Progressive analysis allows for iterative improvements',
        'Use writer suggestions feature for specific rewrite recommendations'
      ]
    };
  }

  /**
   * Generate summary for blended feedback
   */
  private async generateBlendedSummary(
    chunks: ScriptChunk[],
    completedChunks: ChunkFeedback[],
    mentors: Mentor[]
  ): Promise<ChunkedScriptFeedback['summary']> {
    const successfulChunks = completedChunks.filter(chunk => 
      !(chunk as any).processingError
    );

    const failedChunks = completedChunks.filter(chunk => 
      (chunk as any).processingError
    );

    const mentorNames = mentors.map(m => m.name).join(', ');

    return {
      overallStructure: `Blended analysis from ${mentors.length} mentors (${mentorNames}) across ${chunks.length} sections. ${successfulChunks.length}/${chunks.length} sections successfully analyzed with multi-perspective insights.`,

      keyStrengths: [
        `Multi-mentor perspective combining: ${mentorNames}`,
        'Comprehensive analysis from different industry expertise areas',
        'Balanced feedback addressing multiple aspects of storytelling',
        ...(successfulChunks.length > 0 ? [`${successfulChunks.length} sections benefit from blended insights`] : [])
      ],

      majorIssues: [
        ...(failedChunks.length > 0 ? [`${failedChunks.length} sections could not complete blended analysis`] : []),
        ...(successfulChunks.length === 0 ? ['All sections encountered blending issues - try individual mentor analysis'] : [])
      ],

      globalRecommendations: [
        'Review blended feedback for consensus recommendations',
        'Consider individual mentor analysis for sections that failed blending',
        'Use blended insights to identify areas where mentors agree or disagree',
        'Apply different mentor perspectives to different script elements',
        'Progressive blended analysis provides comprehensive script evaluation'
      ]
    };
  }
}

// Export singleton instance
export const progressiveFeedbackService = new ProgressiveFeedbackService();