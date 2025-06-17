// src/services/feedbackChunkService.ts
import { ScriptChunk, ChunkFeedback, ChunkedScriptFeedback, Mentor, Character } from '../types';
import { aiFeedbackService } from './aiFeedbackService';
import { getMentorFeedbackStyle } from '../data/mentors';

export interface ChunkProcessingProgress {
  currentChunk: number;
  totalChunks: number;
  chunkTitle: string;
  progress: number; // 0-100
  message: string;
}

export class FeedbackChunkService {
  /**
   * Generate feedback for all chunks in a script
   * ALWAYS uses backend API via aiFeedbackService
   */
  async generateChunkedFeedback(
    chunks: ScriptChunk[],
    mentor: Mentor,
    characters: Record<string, Character>,
    onProgress?: (progress: ChunkProcessingProgress) => void
  ): Promise<ChunkedScriptFeedback> {
    console.log('🧠 Starting chunked feedback generation via backend API:', {
      mentor: mentor.name,
      chunkCount: chunks.length,
      strategy: chunks[0]?.chunkType || 'unknown'
    });

    const startTime = Date.now();
    const chunkFeedbacks: ChunkFeedback[] = [];
    
    // Process chunks in parallel batches to avoid overwhelming the API
    const batchSize = 3; // Process 3 chunks at a time
    const batches = this.createBatches(chunks, batchSize);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // Process current batch
      const batchPromises = batch.map(async (chunk) => {
        const chunkIndex = chunks.indexOf(chunk);
        
        // Update progress
        if (onProgress) {
          onProgress({
            currentChunk: chunkIndex + 1,
            totalChunks: chunks.length,
            chunkTitle: chunk.title,
            progress: Math.round((chunkIndex / chunks.length) * 100),
            message: `Analyzing ${chunk.title} via backend API...`
          });
        }

        try {
          return await this.generateChunkFeedbackViaBackend(chunk, mentor, characters);
        } catch (error) {
          console.error(`❌ Failed to generate feedback for ${chunk.title}:`, error);
          // Return fallback feedback for failed chunks
          return this.createFallbackChunkFeedback(chunk, mentor);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      chunkFeedbacks.push(...batchResults);
      
      // Small delay between batches to be API-friendly
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Generate overall summary
    const summary = await this.generateOverallSummary(chunks, chunkFeedbacks, mentor);
    
    const processingTime = Date.now() - startTime;
    console.log('✅ Chunked feedback generation complete via backend API:', {
      mentor: mentor.name,
      chunksProcessed: chunkFeedbacks.length,
      processingTime: `${processingTime}ms`,
      averageTimePerChunk: `${Math.round(processingTime / chunks.length)}ms`
    });

    // Final progress update
    if (onProgress) {
      onProgress({
        currentChunk: chunks.length,
        totalChunks: chunks.length,
        chunkTitle: 'Complete',
        progress: 100,
        message: 'Backend API analysis complete!'
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
   * Generate feedback for a single chunk using backend API via aiFeedbackService
   */
  private async generateChunkFeedbackViaBackend(
    chunk: ScriptChunk,
    mentor: Mentor,
    characters: Record<string, Character>
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
      // Generate dual feedback using aiFeedbackService (which now uses backend API)
      const dualFeedback = await aiFeedbackService.generateDualFeedback({
        scene: chunkAsScene,
        mentor,
        characters: chunkCharacters
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
    } catch (error) {
      console.error(`❌ Backend API chunk feedback generation failed for ${chunk.title}:`, error);
      return this.createFallbackChunkFeedback(chunk, mentor);
    }
  }

  /**
   * Get characters that appear in this chunk
   */
  private getChunkCharacters(
    chunk: ScriptChunk, 
    allCharacters: Record<string, Character>
  ): Record<string, Character> {
    const chunkCharacters: Record<string, Character> = {};
    
    chunk.characters.forEach(charName => {
      if (allCharacters[charName]) {
        chunkCharacters[charName] = allCharacters[charName];
      }
    });

    return chunkCharacters;
  }

  /**
   * Create batches for parallel processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Generate an overall summary of the script based on chunk feedback
   */
  private async generateOverallSummary(
    chunks: ScriptChunk[],
    chunkFeedbacks: ChunkFeedback[],
    mentor: Mentor
  ): Promise<ChunkedScriptFeedback['summary']> {
    console.log('📋 Generating overall script summary...');

    // Analyze patterns across chunks
    const structuralIssues = this.extractPatterns(chunkFeedbacks, 'structure');
    const dialogueIssues = this.extractPatterns(chunkFeedbacks, 'dialogue');
    const pacingIssues = this.extractPatterns(chunkFeedbacks, 'pacing');
    const themeIssues = this.extractPatterns(chunkFeedbacks, 'theme');

    // Identify strengths and weaknesses
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
   * Extract common patterns from chunk feedback
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
   * Identify script strengths
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
   * Identify major issues
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
   * Summarize overall structure
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
   * Generate global recommendations based on mentor style
   */
  private generateGlobalRecommendations(
    mentor: Mentor,
    patterns: Record<string, string[]>
  ): string[] {
    const recommendations: string[] = [];

    // Mentor-specific global advice
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
   * Create fallback feedback for failed chunks
   */
  private createFallbackChunkFeedback(chunk: ScriptChunk, mentor: Mentor): ChunkFeedback {
    return {
      chunkId: chunk.id,
      chunkTitle: chunk.title,
      structuredContent: `## ${mentor.name} Analysis - ${chunk.title}\n\n### Analysis Pending\n• This section requires detailed backend API analysis\n• Please retry for comprehensive feedback\n\n"${mentor.mantra}"`,
      scratchpadContent: `## ${mentor.name} Notes - ${chunk.title}\n\n### Initial Observation\n• Section needs full backend API analysis for specific insights\n• Contains ${chunk.content.length} characters of content\n\n### Next Steps\n• Retry analysis for detailed feedback\n\n"${mentor.mantra}"`,
      mentorId: mentor.id,
      timestamp: new Date(),
      categories: {
        structure: 'Requires backend API analysis',
        dialogue: 'Requires backend API analysis', 
        pacing: 'Requires backend API analysis',
        theme: 'Requires backend API analysis'
      }
    };
  }
}