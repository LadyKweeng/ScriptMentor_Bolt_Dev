// src/services/progressiveFeedbackService.ts - Complete enhanced version with cancellation support
import { ScriptChunk, ChunkFeedback, ChunkedScriptFeedback, Mentor, Character, ScriptScene, Feedback, MentorWeights } from '../types';
import { aiFeedbackService } from './aiFeedbackService';
import { FeedbackGenerator } from '../utils/feedbackGenerator';
import { CharacterMemoryManager } from '../utils/characterMemory';
import { backendApiService } from './backendApiService';
import { getMentorFeedbackStyle } from '../data/mentors';
import { CharacterDataNormalizer } from '../utils/characterDataNormalizer';

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
  abortSignal?: AbortSignal; // NEW: Add abort signal support
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
  private isProcessing: boolean = false; // NEW: Track processing state
  private currentAbortController: AbortController | null = null; // NEW: Current abort controller

  constructor() {
    // Initialize with empty character manager - will be updated per call
    this.feedbackGenerator = new FeedbackGenerator(new CharacterMemoryManager({}));
  }

  /**
   * UNIFIED PROCESSING METHOD: Handles chunked, single scene, and blended feedback
   * Uses the same progressive UI for all feedback types
   * ALWAYS uses backend API for ALL modes
   * ENHANCED: Now with cancellation support
   * IMPROVED: Better rate limit handling with exact wait times
   */
  async processChunksProgressively(
    chunks: ScriptChunk[],
    mentor: Mentor,
    characters: Record<string, Character>,
    onProgress: (progress: ProcessingProgress) => void,
    options: Partial<ProgressiveProcessingOptions> = {}
  ): Promise<ChunkedScriptFeedback> {
    const config = { ...this.defaultOptions, ...options };
    
    // NEW: Set up cancellation support
    this.currentAbortController = new AbortController();
    const abortSignal = config.abortSignal || this.currentAbortController.signal;
    
    // NEW: Listen for external abort signal
    if (config.abortSignal) {
      config.abortSignal.addEventListener('abort', () => {
        console.log('🛑 External abort signal received, stopping processing...');
        this.cancelProcessing();
      });
    }

    this.isProcessing = true; // NEW: Set processing state
    const completedChunks: ChunkFeedback[] = [];
    const failedChunks: string[] = [];
    
    // Determine processing type based on chunks and mentor
    const processingType = this.determineProcessingType(chunks, mentor, config);
    
    console.log('🚀 Starting unified progressive feedback processing with backend API and cancellation support...', {
      mentor: mentor.name,
      chunkCount: chunks.length,
      processingType,
      config,
      canCancel: !!abortSignal
    });

    // Update character manager for this processing session
    this.feedbackGenerator = new FeedbackGenerator(new CharacterMemoryManager(characters));

    try {
      for (let i = 0; i < chunks.length; i++) {
        // NEW: Check for cancellation before processing each chunk
        if (abortSignal.aborted) {
          console.log('🛑 Processing cancelled before chunk', i + 1);
          throw new Error('Processing cancelled by user');
        }

        const chunk = chunks[i];
        let success = false;
        let retryCount = 0;
        let lastError: any = null;

        while (!success && retryCount <= config.retryAttempts && !abortSignal.aborted) {
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
              mentorCount: processingType === 'blended' ? 1 : undefined,
              blendingMentors: processingType === 'blended' ? [mentor.name] : undefined
            });

            // Process chunk based on type - ALL use backend API with cancellation support
            let chunkFeedback: ChunkFeedback;

            if (processingType === 'blended') {
              chunkFeedback = await this.processBlendedChunkViaBackend(chunk, mentor, characters, retryCount, abortSignal);
            } else if (processingType === 'single') {
              chunkFeedback = await this.processSingleSceneChunkViaBackend(chunk, mentor, characters, retryCount, abortSignal);
            } else {
              chunkFeedback = await this.processChunkViaBackend(chunk, mentor, characters, retryCount, abortSignal);
            }
            
            completedChunks.push(chunkFeedback);
            success = true;

            console.log(`✅ ${processingType} chunk processed via backend API: ${chunk.title} (attempt ${retryCount + 1})`);

            // Add delay between chunks to respect rate limits (with cancellation support)
            if (i < chunks.length - 1 && !abortSignal.aborted) {
              const delay = this.calculateDelay(retryCount, config);
              await this.sleepWithCancellation(delay, abortSignal);
            }

          } catch (error: any) {
            // NEW: Handle cancellation errors
            if (abortSignal.aborted || error.message?.includes('cancelled')) {
              console.log('🛑 Chunk processing cancelled');
              throw new Error('Processing cancelled by user');
            }

            lastError = error;
            retryCount++;

            if (this.isRateLimitError(error)) {
              console.log(`🚨 Rate limit hit for ${chunk.title} (attempt ${retryCount}/${config.retryAttempts + 1})`);
              
              // IMPROVED: Extract exact wait time from error message
              const waitTimeMatch = error.toString().match(/try again in (\d+\.\d+)s/);
              let retryDelay = this.calculateRetryDelay(retryCount, config);
              
              if (waitTimeMatch && waitTimeMatch[1]) {
                const recommendedWaitTime = parseFloat(waitTimeMatch[1]);
                // Use recommended wait time plus 1 second buffer
                retryDelay = (recommendedWaitTime * 1000) + 1000;
                console.log(`📊 Using exact wait time from API: ${recommendedWaitTime}s + 1s buffer`);
              }
              
              if (retryCount <= config.retryAttempts) {
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

                await this.sleepWithCancellation(retryDelay, abortSignal);
              }
            } else {
              console.error(`❌ Non-rate-limit error for ${chunk.title}:`, error);
              break; // Don't retry non-rate-limit errors
            }
          }
        }

        // If chunk failed after all retries, create fallback feedback (if not cancelled)
        if (!success && !abortSignal.aborted) {
          console.warn(`⚠️ Creating fallback feedback for failed chunk: ${chunk.title}`);
          const fallbackFeedback = this.createFallbackChunkFeedback(chunk, mentor, lastError, retryCount - 1);
          completedChunks.push(fallbackFeedback);
          failedChunks.push(chunk.id);
        }
      }

      // Generate final summary (if not cancelled)
      if (!abortSignal.aborted) {
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
      } else {
        throw new Error('Processing cancelled by user');
      }

    } catch (error: any) {
      // NEW: Handle cancellation gracefully
      if (abortSignal.aborted || error.message?.includes('cancelled')) {
        console.log('🛑 Progressive processing was cancelled');
        
        // Return partial results if any chunks were completed
        if (completedChunks.length > 0) {
          const partialSummary = await this.generateProgressiveSummary(
            chunks.slice(0, completedChunks.length), 
            completedChunks, 
            mentor, 
            processingType
          );

          return {
            id: `cancelled_feedback_${Date.now()}`,
            scriptId: chunks[0]?.id.split('_chunk_')[0] || 'unknown',
            mentorId: mentor.id,
            chunks: completedChunks,
            summary: {
              ...partialSummary,
              overallStructure: `Processing cancelled after ${completedChunks.length}/${chunks.length} sections. ${partialSummary.overallStructure}`,
              majorIssues: [
                'Processing was cancelled by user',
                `${chunks.length - completedChunks.length} sections were not processed`,
                ...partialSummary.majorIssues
              ]
            },
            timestamp: new Date(),
            processingStats: {
              totalChunks: chunks.length,
              successfulChunks: completedChunks.filter(chunk => !(chunk as any).processingError).length,
              rateLimitedChunks: completedChunks.filter(chunk => (chunk as any).processingError === 'rate limit').length,
              permanentlyFailedChunks: failedChunks.length,
              totalRetryAttempts: completedChunks.reduce((sum, chunk) => sum + ((chunk as any).retryCount || 0), 0),
              processingType,
              cancelled: true
            }
          };
        }
        
        throw error;
      }
      
      console.error('❌ Progressive processing failed:', error);
      throw error;
    } finally {
      // NEW: Cleanup
      this.isProcessing = false;
      this.currentAbortController = null;
    }
  }

  /**
   * Enhanced method for processing true blended feedback from multiple mentors
   * ALWAYS uses backend API
   * ENHANCED: Now with cancellation support
   * IMPROVED: Better rate limit handling with exact wait times
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
    
    // NEW: Set up cancellation support
    this.currentAbortController = new AbortController();
    const abortSignal = config.abortSignal || this.currentAbortController.signal;
    
    if (config.abortSignal) {
      config.abortSignal.addEventListener('abort', () => {
        this.cancelProcessing();
      });
    }

    this.isProcessing = true;
    const completedChunks: ChunkFeedback[] = [];
    const failedChunks: string[] = [];
    
    console.log('🔀 Starting true blended mentor feedback processing via backend API with cancellation...', {
      mentors: mentors.map(m => m.name),
      chunkCount: chunks.length,
      weights: mentorWeights,
      canCancel: !!abortSignal
    });

    // Update character manager
    this.feedbackGenerator = new FeedbackGenerator(new CharacterMemoryManager(characters));

    try {
      for (let i = 0; i < chunks.length; i++) {
        // NEW: Check for cancellation
        if (abortSignal.aborted) {
          throw new Error('Blended processing cancelled by user');
        }

        const chunk = chunks[i];
        let success = false;
        let retryCount = 0;
        let lastError: any = null;

        while (!success && retryCount <= config.retryAttempts && !abortSignal.aborted) {
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

            // Generate blended feedback using backend API via aiFeedbackService with cancellation
            const blendedFeedback = await aiFeedbackService.generateBlendedFeedback(
              chunkAsScene,
              mentors,
              mentorWeights,
              characters,
              abortSignal // NEW: Pass abort signal
            );

            // Convert blended feedback to chunk format
            const chunkFeedback: ChunkFeedback = {
              chunkId: chunk.id,
              chunkTitle: chunk.title,
              structuredContent: blendedFeedback.feedback.structuredContent || '',
              scratchpadContent: blendedFeedback.feedback.scratchpadContent || '',
              mentorId: 'blended',
              timestamp: new Date(),
              categories: blendedFeedback.feedback.categories || {
                structure: 'Blended analysis',
                dialogue: 'Blended analysis',
                pacing: 'Blended analysis',
                theme: 'Blended analysis'
              },
              retryCount
            } as ChunkFeedback & { retryCount: number };

            completedChunks.push(chunkFeedback);
            success = true;

            console.log(`✅ Blended chunk processed via backend API: ${chunk.title} from ${mentors.length} mentors`);

            // Longer delay for blended processing (with cancellation)
            if (i < chunks.length - 1 && !abortSignal.aborted) {
              await this.sleepWithCancellation(config.baseDelay * 1.5, abortSignal);
            }

          } catch (error: any) {
            if (abortSignal.aborted || error.message?.includes('cancelled')) {
              throw new Error('Blended processing cancelled by user');
            }

            lastError = error;
            retryCount++;

            // IMPROVED: Check for rate limit errors and extract wait time
            if (this.isRateLimitError(error)) {
              const waitTimeMatch = error.toString().match(/try again in (\d+\.\d+)s/);
              let retryDelay = this.calculateRetryDelay(retryCount, config);
              
              if (waitTimeMatch && waitTimeMatch[1]) {
                const recommendedWaitTime = parseFloat(waitTimeMatch[1]);
                // Use recommended wait time plus 1 second buffer
                retryDelay = (recommendedWaitTime * 1000) + 1000;
                console.log(`📊 Using exact wait time from API: ${recommendedWaitTime}s + 1s buffer`);
              }
              
              if (retryCount <= config.retryAttempts) {
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
                  processingType: 'blended',
                  mentorCount: mentors.length,
                  blendingMentors: mentors.map(m => m.name)
                });

                await this.sleepWithCancellation(retryDelay, abortSignal);
                continue;
              }
            }

            if (retryCount <= config.retryAttempts) {
              const retryDelay = this.calculateRetryDelay(retryCount, config);
              await this.sleepWithCancellation(retryDelay, abortSignal);
            }
          }
        }

        if (!success && !abortSignal.aborted) {
          const fallbackFeedback = this.createBlendedFallbackFeedback(chunk, mentors, lastError, retryCount - 1);
          completedChunks.push(fallbackFeedback);
          failedChunks.push(chunk.id);
        }
      }

      if (abortSignal.aborted) {
        throw new Error('Blended processing cancelled by user');
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

    } catch (error: any) {
      if (abortSignal.aborted || error.message?.includes('cancelled')) {
        console.log('🛑 Blended processing was cancelled');
        
        // Return partial results if any
        if (completedChunks.length > 0) {
          const partialSummary = await this.generateBlendedSummary(
            chunks.slice(0, completedChunks.length), 
            completedChunks, 
            mentors
          );

          return {
            id: `cancelled_blended_feedback_${Date.now()}`,
            scriptId: chunks[0]?.id.split('_chunk_')[0] || 'unknown',
            mentorId: 'blended',
            chunks: completedChunks,
            summary: {
              ...partialSummary,
              overallStructure: `Blended processing cancelled after ${completedChunks.length}/${chunks.length} sections. ${partialSummary.overallStructure}`,
              majorIssues: [
                'Blended processing was cancelled by user',
                `${chunks.length - completedChunks.length} sections were not processed`,
                ...partialSummary.majorIssues
              ]
            },
            timestamp: new Date(),
            processingStats: {
              totalChunks: chunks.length,
              successfulChunks: completedChunks.filter(chunk => !(chunk as any).processingError).length,
              rateLimitedChunks: 0,
              permanentlyFailedChunks: failedChunks.length,
              totalRetryAttempts: completedChunks.reduce((sum, chunk) => sum + ((chunk as any).retryCount || 0), 0),
              processingType: 'blended',
              mentorCount: mentors.length,
              cancelled: true
            }
          };
        }
        
        throw error;
      }
      
      throw error;
    } finally {
      this.isProcessing = false;
      this.currentAbortController = null;
    }
  }

  /**
   * NEW: Cancel ongoing processing
   */
  cancelProcessing(): void {
    console.log('🛑 Cancelling progressive feedback processing...');
    
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    
    // Cancel all backend API requests
    backendApiService.cancelAllRequests();
    
    this.isProcessing = false;
    
    console.log('✅ Processing cancellation initiated');
  }

  /**
   * NEW: Check if currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * NEW: Sleep with cancellation support
   */
  private async sleepWithCancellation(ms: number, abortSignal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new Error('Sleep cancelled'));
      };
      
      if (abortSignal.aborted) {
        clearTimeout(timeout);
        reject(new Error('Sleep cancelled'));
        return;
      }
      
      abortSignal.addEventListener('abort', onAbort);
      
      setTimeout(() => {
        abortSignal.removeEventListener('abort', onAbort);
      }, ms);
    });
  }

  /**
   * Process a single chunk using backend API directly
   * ENHANCED: Now with cancellation support
   * IMPROVED: Better rate limit handling with exact wait times
   */
  private async processChunkViaBackend(
    chunk: ScriptChunk,
    mentor: Mentor,
    characters: Record<string, Character>,
    retryCount: number = 0,
    abortSignal: AbortSignal
  ): Promise<ChunkFeedback> {
    console.log(`🎯 Processing chunk via backend API: ${chunk.title} (attempt ${retryCount + 1})`);

    try {
      // Check for cancellation
      if (abortSignal.aborted) {
        throw new Error('Chunk processing cancelled');
      }

      // Get chunk-specific characters
      const chunkCharacters = this.getChunkCharacters(chunk, characters);
      const characterContext = CharacterDataNormalizer.createCharacterContext(chunkCharacters);
      const feedbackStyle = getMentorFeedbackStyle(mentor);

      // Generate both structured and scratchpad feedback via backend API with cancellation
      const [structuredContent, scratchpadContent] = await Promise.all([
        backendApiService.generateFeedback({
          scene_content: chunk.content,
          mentor_id: mentor.id,
          character_context: characterContext,
          feedback_mode: 'structured',
          system_prompt: feedbackStyle.systemPrompt,
          temperature: feedbackStyle.temperature
        }, abortSignal), // NEW: Pass abort signal
        backendApiService.generateFeedback({
          scene_content: chunk.content,
          mentor_id: mentor.id,
          character_context: characterContext,
          feedback_mode: 'scratchpad',
          system_prompt: feedbackStyle.systemPrompt,
          temperature: feedbackStyle.temperature
        }, abortSignal) // NEW: Pass abort signal
      ]);

      return {
        chunkId: chunk.id,
        chunkTitle: chunk.title,
        structuredContent: this.cleanFeedbackContent(structuredContent, mentor),
        scratchpadContent: this.cleanFeedbackContent(scratchpadContent, mentor),
        mentorId: mentor.id,
        timestamp: new Date(),
        categories: this.extractCategoriesFromFeedback(structuredContent),
        retryCount
      } as ChunkFeedback & { retryCount: number };

    } catch (error: any) {
      // NEW: Handle cancellation
      if (abortSignal.aborted || error.message?.includes('cancelled')) {
        throw new Error('Chunk processing cancelled');
      }

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
   * Process single scene chunk via backend API
   * ENHANCED: Now with cancellation support
   * IMPROVED: Better rate limit handling with exact wait times
   */
  private async processSingleSceneChunkViaBackend(
    chunk: ScriptChunk,
    mentor: Mentor,
    characters: Record<string, Character>,
    retryCount: number = 0,
    abortSignal: AbortSignal
  ): Promise<ChunkFeedback> {
    console.log(`🎭 Processing single scene via backend API: ${chunk.title} with ${mentor.name} (attempt ${retryCount + 1})`);

    try {
      // Check for cancellation
      if (abortSignal.aborted) {
        throw new Error('Single scene processing cancelled');
      }

      // Use aiFeedbackService which now uses backend API
      const sceneAsScene: ScriptScene = {
        id: chunk.id,
        title: chunk.title,
        content: chunk.content,
        characters: chunk.characters
      };

      const dualFeedback = await aiFeedbackService.generateDualFeedback({
        scene: sceneAsScene,
        mentor,
        characters,
        abortSignal // NEW: Pass abort signal
      });

      return {
        chunkId: chunk.id,
        chunkTitle: chunk.title,
        structuredContent: dualFeedback.feedback.structuredContent || '',
        scratchpadContent: dualFeedback.feedback.scratchpadContent || '',
        mentorId: mentor.id,
        timestamp: new Date(),
        categories: dualFeedback.feedback.categories || {
          structure: 'Analyzed',
          dialogue: 'Analyzed',
          pacing: 'Analyzed',
          theme: 'Analyzed'
        },
        retryCount
      } as ChunkFeedback & { retryCount: number };

    } catch (error: any) {
      // NEW: Handle cancellation
      if (abortSignal.aborted || error.message?.includes('cancelled')) {
        throw new Error('Single scene processing cancelled');
      }

      if (this.isRateLimitError(error)) {
        // IMPROVED: Extract exact wait time from error message
        const waitTimeMatch = error.toString().match(/try again in (\d+\.\d+)s/);
        if (waitTimeMatch && waitTimeMatch[1]) {
          const recommendedWaitTime = parseFloat(waitTimeMatch[1]);
          console.log(`📊 Rate limit hit with recommended wait time: ${recommendedWaitTime}s + 1s buffer`);
        }
        
        throw new Error(`RATE_LIMIT: ${error.message}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Process blended chunk via backend API
   * ENHANCED: Now with cancellation support
   * IMPROVED: Better rate limit handling with exact wait times
   */
  private async processBlendedChunkViaBackend(
    chunk: ScriptChunk,
    blendedMentor: Mentor,
    characters: Record<string, Character>,
    retryCount: number = 0,
    abortSignal: AbortSignal
  ): Promise<ChunkFeedback> {
    console.log(`🔀 Processing blended chunk via backend API: ${chunk.title} (attempt ${retryCount + 1})`);

    try {
      // Check for cancellation
      if (abortSignal.aborted) {
        throw new Error('Blended processing cancelled');
      }

      // Use aiFeedbackService which now supports blended feedback via backend API
      const sceneAsScene: ScriptScene = {
        id: chunk.id,
        title: chunk.title,
        content: chunk.content,
        characters: chunk.characters
      };

      const dualFeedback = await aiFeedbackService.generateDualFeedback({
        scene: sceneAsScene,
        mentor: blendedMentor,
        characters,
        abortSignal // NEW: Pass abort signal
      });

      return {
        chunkId: chunk.id,
        chunkTitle: chunk.title,
        structuredContent: dualFeedback.feedback.structuredContent || '',
        scratchpadContent: dualFeedback.feedback.scratchpadContent || '',
        mentorId: 'blended',
        timestamp: new Date(),
        categories: dualFeedback.feedback.categories || {
          structure: 'Blended analysis',
          dialogue: 'Blended analysis',
          pacing: 'Blended analysis',
          theme: 'Blended analysis'
        },
        retryCount
      } as ChunkFeedback & { retryCount: number };

    } catch (error: any) {
      // NEW: Handle cancellation
      if (abortSignal.aborted || error.message?.includes('cancelled')) {
        throw new Error('Blended processing cancelled');
      }

      if (this.isRateLimitError(error)) {
        // IMPROVED: Extract exact wait time from error message
        const waitTimeMatch = error.toString().match(/try again in (\d+\.\d+)s/);
        if (waitTimeMatch && waitTimeMatch[1]) {
          const recommendedWaitTime = parseFloat(waitTimeMatch[1]);
          console.log(`📊 Rate limit hit with recommended wait time: ${recommendedWaitTime}s + 1s buffer`);
        }
        
        throw new Error(`RATE_LIMIT: ${error.message}`);
      } else {
        throw error;
      }
    }
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
          : `Analyzing scene with ${mentor.name}'s expertise via backend API`;
      
      case 'blended':
        return retryCount > 0
          ? `Retrying blended mentor analysis for ${baseTitle}${retryText}`
          : `Blending mentor perspectives for ${baseTitle} via backend API`;
      
      case 'chunked':
      default:
        return retryCount > 0
          ? `Retrying ${mentor.name} analysis for ${baseTitle}${retryText}`
          : `Analyzing ${baseTitle} with ${mentor.name} via backend API`;
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
        return `${baseMessage} scene analyzed with backend AI feedback${rateLimitText}`;
      
      case 'blended':
        return `${baseMessage} sections analyzed with blended mentor insights via backend API${rateLimitText}`;
      
      case 'chunked':
      default:
        return `${baseMessage} chunks with backend AI feedback${rateLimitText}`;
    }
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
    const cleanedContent = content.trim();
    return `${cleanedContent}\n\n"${mentor.mantra}"`;
  }

  /**
   * Check if error is rate limit related
   * IMPROVED: More comprehensive detection of rate limit errors
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
   * IMPROVED: More sophisticated backoff calculation
   */
  private calculateRetryDelay(retryCount: number, config: ProgressiveProcessingOptions): number {
    if (config.exponentialBackoff) {
      // Use exponential backoff with jitter to avoid thundering herd
      const baseDelay = config.baseDelay * Math.pow(2, retryCount - 1);
      const jitter = Math.random() * 0.3 * baseDelay; // Add up to 30% jitter
      return baseDelay + jitter;
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
      overallStructure: `Script processed in ${chunks.length} ${typeLabel} with ${successRate}% backend API analysis success rate. ${successfulChunks.length} ${typeLabel} received full ${mentor.name} feedback${rateLimitedChunks.length > 0 ? `, ${rateLimitedChunks.length} ${typeLabel} hit API rate limits` : ''}${otherFailedChunks.length > 0 ? `, ${otherFailedChunks.length} ${typeLabel} had processing issues` : ''}.`,
      
      keyStrengths: successfulChunks.length > 0 ? [
        `${successfulChunks.length} ${typeLabel} analyzed with backend AI-powered ${mentor.name} feedback`,
        processingType === 'blended' ? 'Multi-perspective analysis provides comprehensive insights via backend API' : `${mentor.name}'s expertise applied systematically via backend API`,
        'Progressive processing allows for real-time review of completed sections'
      ] : ['Partial processing completed - manual review recommended'],

      majorIssues: [
        ...(rateLimitedChunks.length > 0 ? [`${rateLimitedChunks.length} ${typeLabel} hit API rate limits and used fallback analysis`] : []),
        ...(otherFailedChunks.length > 0 ? [`${otherFailedChunks.length} ${typeLabel} encountered processing issues and need manual review`] : []),
        ...(successfulChunks.length === 0 ? ['All sections encountered processing issues - manual analysis recommended'] : [])
      ],

      globalRecommendations: [
        ...(successfulChunks.length > 0 ? ['Review completed backend AI analysis for specific script improvements'] : []),
        ...(rateLimitedChunks.length > 0 ? ['Retry rate-limited sections during off-peak hours for full backend AI analysis'] : []),
        ...(otherFailedChunks.length > 0 ? ['Manual analysis recommended for sections that encountered processing issues'] : []),
        processingType === 'single' ? 'Consider chunking longer scripts for more detailed analysis' : 'Progressive analysis allows for iterative improvements',
        'Use writer suggestions feature for specific rewrite recommendations'
      ]
    };
  }

  /**
   * Generate AI-powered summary for blended feedback
   * ENHANCED: Now generates actual AI content instead of templates
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

    // NEW: Try to generate AI-powered summary if we have successful chunks
    if (successfulChunks.length > 0) {
      try {
        const aiSummary = await this.generateAIBlendedSummary(successfulChunks, mentors);
        if (aiSummary) {
          return {
            overallStructure: aiSummary.overallStructure,
            keyStrengths: aiSummary.keyStrengths,
            majorIssues: [
              ...aiSummary.majorIssues,
              ...(failedChunks.length > 0 ? [`${failedChunks.length} sections could not complete blended analysis`] : [])
            ],
            globalRecommendations: aiSummary.globalRecommendations
          };
        }
      } catch (error) {
        console.warn('⚠️ AI summary generation failed, falling back to template:', error);
      }
    }

    // FALLBACK: Template-based summary (existing logic)
    return {
      overallStructure: `Blended analysis from ${mentors.length} mentors (${mentorNames}) across ${chunks.length} sections via backend API. ${successfulChunks.length}/${chunks.length} sections successfully analyzed with multi-perspective insights.`,
      keyStrengths: [
        `Multi-mentor perspective combining: ${mentorNames}`,
        'Comprehensive analysis from different industry expertise areas via backend API',
        'Balanced feedback addressing multiple aspects of storytelling',
        ...(successfulChunks.length > 0 ? [`${successfulChunks.length} sections benefit from blended insights`] : [])
      ],
      majorIssues: [
        ...(failedChunks.length > 0 ? [`${failedChunks.length} sections could not complete blended analysis`] : []),
        ...(successfulChunks.length === 0 ? ['No sections completed successfully - manual review required'] : [])
      ],
      globalRecommendations: [
        'Review individual section feedback for specific improvements',
        'Consider the consensus points from multiple mentoring perspectives',
        'Focus on areas where multiple mentors agree on issues',
        'Leverage the diverse viewpoints for comprehensive script development'
      ]
    };
  }
  /**
 * NEW: Generate AI-powered blended summary from successful chunks
 */
private async generateAIBlendedSummary(
  successfulChunks: ChunkFeedback[], 
  mentors: Mentor[]
): Promise<{
  overallStructure: string;
  keyStrengths: string[];
  majorIssues: string[];
  globalRecommendations: string[];
} | null> {
  try {
    console.log('🤖 Generating AI-powered blended summary from', successfulChunks.length, 'chunks');

    // Combine all feedback content for analysis
    const combinedFeedback = successfulChunks.map(chunk => {
      return `=== ${chunk.chunkTitle} ===\n` +
             `STRUCTURED: ${chunk.structuredContent}\n` +
             `SCRATCHPAD: ${chunk.scratchpadContent}\n`;
    }).join('\n\n');

    const mentorNames = mentors.map(m => m.name).join(', ');

    // Create AI prompt for summary generation
    const summaryPrompt = `You are analyzing blended feedback from multiple screenplay mentors (${mentorNames}) across ${successfulChunks.length} script sections. 

COMBINED FEEDBACK TO ANALYZE:
${combinedFeedback}

Generate a comprehensive script overview that synthesizes insights from all mentors and sections. Focus on:
1. Overall structural assessment across all sections
2. Consensus strengths that multiple mentors/sections highlight
3. Common issues that appear across sections
4. Global recommendations that address script-wide patterns

Provide your analysis in JSON format:
{
  "overallStructure": "2-3 sentence assessment of the script's overall structural integrity, dramatic flow, and narrative effectiveness based on the blended analysis",
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "majorIssues": ["issue 1", "issue 2", "issue 3"],
  "globalRecommendations": ["recommendation 1", "recommendation 2", "recommendation 3", "recommendation 4"]
}

Make this sound like genuine professional feedback, not template text. Focus on the actual content analyzed.`;

    // Try to call AI service for summary generation
    const summaryResponse = await this.callAIForSummary(summaryPrompt);
    
    if (summaryResponse) {
      console.log('✅ AI-generated blended summary created successfully');
      return summaryResponse;
    }

    return null;
  } catch (error) {
    console.error('❌ AI summary generation failed:', error);
    return null;
  }
}

/**
 * NEW: Call AI service for summary generation
 * IMPROVED: Added rate limit handling with exact wait times
 */
private async callAIForSummary(prompt: string): Promise<{
  overallStructure: string;
  keyStrengths: string[];
  majorIssues: string[];
  globalRecommendations: string[];
} | null> {
  try {
    // Try using the backend API service first with improved rate limit handling
    try {
      // IMPROVED: Use the enhanced generateAnalysis method with retry logic
      const response = await backendApiService.generateAnalysis({
        prompt,
        analysisType: 'summary',
        model: 'gpt-4o-mini',
        temperature: 0.3
      });
      
      if (response && typeof response === 'string') {
        const parsed = JSON.parse(response);
        return {
          overallStructure: parsed.overallStructure || '',
          keyStrengths: Array.isArray(parsed.keyStrengths) ? parsed.keyStrengths : [],
          majorIssues: Array.isArray(parsed.majorIssues) ? parsed.majorIssues : [],
          globalRecommendations: Array.isArray(parsed.globalRecommendations) ? parsed.globalRecommendations : []
        };
      }
    } catch (backendError) {
      console.warn('Backend API not available for summary generation, trying direct approach');
    }

    // Fallback: Direct OpenAI call (if environment supports it)
    if (typeof window === 'undefined' && process.env.OPENAI_API_KEY) {
      // IMPROVED: Add retry logic for direct OpenAI calls
      let retryCount = 0;
      const maxRetries = 3;
      let lastError: Error | null = null;

      while (retryCount <= maxRetries) {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert screenplay analyst who creates comprehensive script overviews from detailed feedback analysis.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.3,
              response_format: { type: 'json_object' }
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = `OpenAI API Error: ${response.status} - ${errorData.error?.message || response.statusText}`;
            
            // Check for rate limit errors (429 status code)
            if (response.status === 429) {
              const waitTimeMatch = errorData.error?.message?.match(/try again in (\d+\.\d+)s/);
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
          const content = data.choices?.[0]?.message?.content;

          if (content) {
            const parsed = JSON.parse(content);
            return {
              overallStructure: parsed.overallStructure || '',
              keyStrengths: Array.isArray(parsed.keyStrengths) ? parsed.keyStrengths : [],
              majorIssues: Array.isArray(parsed.majorIssues) ? parsed.majorIssues : [],
              globalRecommendations: Array.isArray(parsed.globalRecommendations) ? parsed.globalRecommendations : []
            };
          }
          
          break; // Exit loop if we got a response but no content
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
          
          // If we've reached max retries or it's not a rate limit error, throw
          if (retryCount >= maxRetries || 
              !(lastError.message.includes('rate limit') || 
                lastError.message.includes('429') || 
                lastError.message.includes('try again in'))) {
            throw lastError;
          }
          
          // Otherwise, use exponential backoff
          const backoffTime = Math.pow(2, retryCount) * 1000;
          console.log(`⏱️ Retrying after ${backoffTime/1000} seconds (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retryCount++;
        }
      }
      
      // If we've exhausted all retries, throw the last error
      if (lastError) {
        throw lastError;
      }
    }

    return null;
  } catch (error) {
    console.error('❌ AI summary API call failed:', error);
    return null;
  }
}
}

// Export singleton instance
export const progressiveFeedbackService = new ProgressiveFeedbackService();