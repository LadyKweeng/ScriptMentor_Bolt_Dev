// src/services/aiFeedbackService.ts - Complete enhanced version with token integration + all original features
import { Mentor, ScriptScene, Feedback, ScriptRewrite, Character, TokenAwareRequest, TokenAwareResponse } from '../types';
import { backendApiService } from './backendApiService';
import { tokenService } from './tokenService';
import { getMentorFeedbackStyle } from '../data/mentors';
import { CharacterDataNormalizer } from '../utils/characterDataNormalizer';

// PRESERVED: Original interfaces
interface AIFeedbackRequest {
  scene: ScriptScene;
  mentor: Mentor;
  characters: Record<string, Character>;
  abortSignal?: AbortSignal;
}

interface AIFeedbackResponse {
  feedback: Feedback;
  rewrite?: ScriptRewrite;
}

// NEW: Token-aware interfaces (extending original)
interface TokenAwareAIFeedbackRequest extends AIFeedbackRequest, TokenAwareRequest {}

interface TokenAwareAIFeedbackResponse extends TokenAwareResponse<Feedback> {
  feedback: Feedback;
  rewrite?: ScriptRewrite;
}

interface BlendedFeedbackRequest extends TokenAwareRequest {
  scene: ScriptScene;
  mentors: Mentor[];
  mentorWeights: Record<string, number>;
  characters: Record<string, Character>;
  abortSignal?: AbortSignal;
}

// PRESERVED: Original ScriptRewrite interface (if not in types)
interface ScriptRewrite {
  id: string;
  content: string;
  changes: string[];
  reasoning: string;
}

class AIFeedbackService {
  constructor() {
    this.checkBackendHealth();
  }
  
  /**
   * PRESERVED: Original backend health check
   */
  private async checkBackendHealth(): Promise<void> {
    try {
      const isHealthy = await backendApiService.healthCheck();
      console.log(`🔗 Backend connection: ${isHealthy ? 'Connected ✅' : 'Disconnected ❌'}`);
    } catch (error) {
      console.warn('Backend health check failed:', error);
    }
  }
  
  /**
   * NEW: Token-aware dual feedback generation
   * ENHANCED: Preserves original functionality + adds token validation
   */
  async generateDualFeedback(request: TokenAwareAIFeedbackRequest): Promise<TokenAwareAIFeedbackResponse> {
    const { userId, scene, mentor, characters, actionType = 'single_feedback', scriptId, mentorId, sceneId, abortSignal } = request;
    
    console.log('🤖 AI Service generating dual feedback with token validation + cancellation support:', {
      userId,
      mentor: mentor.name,
      mentorId: mentor.id,
      sceneLength: scene.content.length,
      characterCount: Object.keys(characters).length,
      isBlended: mentor.id === 'blended',
      canCancel: !!abortSignal,
      actionType
    });

    try {
      // NEW: Check for cancellation before token validation
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled before processing');
      }

      // NEW: Step 1 - Token validation and deduction
      const tokenResult = await tokenService.processTokenTransaction(
        userId,
        actionType,
        scriptId || scene.id,
        mentorId || mentor.id,
        sceneId || scene.id
      );

      if (!tokenResult.success) {
        const errorMessage = tokenResult.validation.hasEnoughTokens 
          ? 'Token deduction failed due to system error'
          : `Insufficient tokens. Need ${tokenResult.validation.requiredTokens}, have ${tokenResult.validation.currentBalance}`;
        
        return {
          success: false,
          error: errorMessage,
          feedback: this.createEmptyFeedback(scene, mentor),
          tokenInfo: {
            tokensUsed: 0,
            remainingBalance: tokenResult.validation.currentBalance,
            action: actionType
          }
        };
      }

      // NEW: Check for cancellation after token processing
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled after token processing');
      }

      // PRESERVED: Step 2 - Original feedback generation logic
      const feedbackResult = await this.performOriginalDualFeedback({
        scene,
        mentor,
        characters,
        abortSignal
      });
      
      return {
        success: true,
        feedback: feedbackResult.feedback,
        rewrite: feedbackResult.rewrite,
        data: feedbackResult.feedback,
        tokenInfo: {
          tokensUsed: tokenService.getTokenCost(actionType),
          remainingBalance: tokenResult.validation.currentBalance,
          action: actionType
        }
      };

    } catch (error: any) {
      console.error('❌ AI Feedback generation failed:', error);
      
      // Handle cancellation vs other errors
      if (abortSignal?.aborted || error.message?.includes('cancelled')) {
        return {
          success: false,
          error: 'Feedback generation cancelled by user',
          feedback: this.createEmptyFeedback(scene, mentor),
          tokenInfo: {
            tokensUsed: 0,
            remainingBalance: 0,
            action: actionType
          }
        };
      }
      
      return {
        success: false,
        error: `Feedback generation failed: ${error.message}`,
        feedback: this.createEmptyFeedback(scene, mentor),
        tokenInfo: {
          tokensUsed: tokenService.getTokenCost(actionType),
          remainingBalance: 0, // We don't know the balance after failure
          action: actionType
        }
      };
    }
  }

  /**
   * PRESERVED: Original dual feedback generation (without token integration)
   * Used internally after token validation
   * NEW: Made public for use by other services (like feedbackChunkService)
   */
  async performOriginalDualFeedback(request: AIFeedbackRequest): Promise<AIFeedbackResponse> {
    console.log('🤖 Performing original dual feedback generation:', {
      mentor: request.mentor.name,
      mentorId: request.mentor.id,
      sceneLength: request.scene.content.length,
      characterCount: Object.keys(request.characters).length,
      isBlended: request.mentor.id === 'blended',
      canCancel: !!request.abortSignal
    });
    
    try {
      // Check for cancellation before starting
      if (request.abortSignal?.aborted) {
        throw new Error('Request cancelled before processing');
      }

      // Get mentor-specific feedback style
      const feedbackStyle = getMentorFeedbackStyle(request.mentor);
      
      // Build character context with proper error handling
      const characterContext = this.buildCharacterContext(request.characters);
      
      // Check for cancellation before backend calls
      if (request.abortSignal?.aborted) {
        throw new Error('Request cancelled before backend calls');
      }

      // ALWAYS use backend API for both structured and scratchpad feedback with cancellation
      const [structuredContent, scratchpadContent] = await Promise.all([
        this.generateBackendFeedback(request, 'structured', characterContext, feedbackStyle),
        this.generateBackendFeedback(request, 'scratchpad', characterContext, feedbackStyle)
      ]);
      
      // Check for cancellation after backend calls
      if (request.abortSignal?.aborted) {
        throw new Error('Request cancelled after backend processing');
      }

      // Create the dual feedback object
      const feedback = this.createDualFeedbackObject(
        structuredContent, 
        scratchpadContent, 
        request
      );
      
      console.log('✅ Successfully generated both structured and scratchpad feedback via backend API');
      return { feedback };
      
    } catch (error: any) {
      // Handle cancellation
      if (request.abortSignal?.aborted || error.message?.includes('cancelled')) {
        console.log('🛑 AI feedback generation was cancelled');
        throw new Error('Feedback generation cancelled by user');
      }
      
      console.warn('❌ Backend API failed, using enhanced mock feedback:', error);
      return { feedback: this.generateEnhancedDualFeedback(request) };
    }
  }

  /**
   * NEW: Token-aware blended feedback generation
   * ENHANCED: Preserves original functionality + adds token validation
   */
  async generateBlendedFeedback(request: BlendedFeedbackRequest): Promise<TokenAwareAIFeedbackResponse> {
    const { userId, scene, mentors, mentorWeights, characters, actionType = 'blended_feedback', scriptId, sceneId, abortSignal } = request;
    
    console.log('🎭 AI Service generating blended feedback with token validation + cancellation support:', {
      userId,
      mentorCount: mentors.length,
      sceneLength: scene.content.length,
      actionType,
      canCancel: !!abortSignal
    });

    // Create a blended mentor for the request
    const blendedMentor: Mentor = {
      id: 'blended',
      name: 'Blended Mentoring',
      tone: 'collaborative',
      styleNotes: 'Multiple perspectives combined',
      avatar: '🎭',
      accent: 'multi-voice',
      mantra: 'Multiple perspectives reveal the full picture.',
      feedbackStyle: 'analytical',
      priorities: ['comprehensive analysis', 'diverse viewpoints'],
      analysisApproach: 'multi-perspective'
    };

    try {
      // Check for cancellation before token validation
      if (abortSignal?.aborted) {
        throw new Error('Blended feedback generation cancelled before processing');
      }

      // Token validation and deduction
      const tokenResult = await tokenService.processTokenTransaction(
        userId,
        actionType,
        scriptId || scene.id,
        'blended',
        sceneId || scene.id
      );

      if (!tokenResult.success) {
        const errorMessage = tokenResult.validation.hasEnoughTokens 
          ? 'Token deduction failed due to system error'
          : `Insufficient tokens for blended feedback. Need ${tokenResult.validation.requiredTokens}, have ${tokenResult.validation.currentBalance}`;
        
        return {
          success: false,
          error: errorMessage,
          feedback: this.createEmptyFeedback(scene, blendedMentor),
          tokenInfo: {
            tokensUsed: 0,
            remainingBalance: tokenResult.validation.currentBalance,
            action: actionType
          }
        };
      }

      // Check for cancellation after token processing
      if (abortSignal?.aborted) {
        throw new Error('Blended feedback generation cancelled after token processing');
      }

      // Perform original blended feedback generation
      const feedbackResult = await this.performOriginalBlendedFeedback(
        scene, mentors, mentorWeights, characters, abortSignal
      );
      
      return {
        success: true,
        feedback: feedbackResult.feedback,
        rewrite: feedbackResult.rewrite,
        data: feedbackResult.feedback,
        tokenInfo: {
          tokensUsed: tokenService.getTokenCost(actionType),
          remainingBalance: tokenResult.validation.currentBalance,
          action: actionType
        }
      };

    } catch (error: any) {
      console.error('❌ Blended feedback generation failed:', error);
      
      // Handle cancellation vs other errors
      if (abortSignal?.aborted || error.message?.includes('cancelled')) {
        return {
          success: false,
          error: 'Blended feedback generation cancelled by user',
          feedback: this.createEmptyFeedback(scene, blendedMentor),
          tokenInfo: {
            tokensUsed: 0,
            remainingBalance: 0,
            action: actionType
          }
        };
      }
      
      return {
        success: false,
        error: `Blended feedback generation failed: ${error.message}`,
        feedback: this.createEmptyFeedback(scene, blendedMentor),
        tokenInfo: {
          tokensUsed: tokenService.getTokenCost(actionType),
          remainingBalance: 0,
          action: actionType
        }
      };
    }
  }

  /**
   * PRESERVED: Original blended feedback generation (without token integration)
   * Used internally after token validation
   */
  private async performOriginalBlendedFeedback(
    scene: ScriptScene,
    mentors: Mentor[],
    mentorWeights: Record<string, number>,
    characters: Record<string, Character>,
    abortSignal?: AbortSignal
  ): Promise<AIFeedbackResponse> {
    console.log('🎭 Performing original blended feedback generation:', {
      mentors: mentors.map(m => m.name),
      sceneLength: scene.content.length,
      characterCount: Object.keys(characters).length,
      weights: mentorWeights,
      canCancel: !!abortSignal
    });

    try {
      // Check for cancellation before starting
      if (abortSignal?.aborted) {
        throw new Error('Blended feedback generation cancelled before processing');
      }

      // Build character context
      const characterContext = this.buildCharacterContext(characters);
      
      // Create blended mentor object for backend processing
      const blendedMentor: Mentor = {
        id: 'blended',
        name: 'Blended Mentors',
        tone: `Combined insights from: ${mentors.map(m => m.name).join(', ')}`,
        styleNotes: 'Multi-perspective analysis combining different mentoring approaches',
        avatar: 'https://images.pexels.com/photos/7102/notes-macbook-study-conference.jpg?auto=compress&cs=tinysrgb&w=600',
        accent: '#8b5cf6',
        mantra: 'Multiple perspectives reveal the full picture.',
        feedbackStyle: 'analytical',
        priorities: ['multi-perspective-analysis', 'consensus-building', 'comprehensive-coverage'],
        analysisApproach: 'Combines insights from multiple mentoring perspectives'
      };

      // Check for cancellation before processing
      if (abortSignal?.aborted) {
        throw new Error('Blended feedback generation cancelled before backend processing');
      }

      // Generate blended feedback using backend API with special blended context and cancellation
      const blendedRequest = {
        scene,
        mentor: blendedMentor,
        characters,
        abortSignal
      };

      const [structuredContent, scratchpadContent] = await Promise.all([
        this.generateBlendedBackendFeedback(blendedRequest, 'structured', characterContext, mentors, mentorWeights),
        this.generateBlendedBackendFeedback(blendedRequest, 'scratchpad', characterContext, mentors, mentorWeights)
      ]);

      // Check for cancellation after backend processing
      if (abortSignal?.aborted) {
        throw new Error('Blended feedback generation cancelled after backend processing');
      }

      const feedback = this.createDualFeedbackObject(
        structuredContent,
        scratchpadContent,
        blendedRequest
      );

      console.log('✅ Successfully generated blended feedback via backend API');
      return { feedback };

    } catch (error: any) {
      // Handle cancellation
      if (abortSignal?.aborted || error.message?.includes('cancelled')) {
        console.log('🛑 Blended feedback generation was cancelled');
        throw new Error('Blended feedback generation cancelled by user');
      }
      
      console.warn('❌ Blended feedback backend API failed, using enhanced mock:', error);
      return { feedback: this.generateEnhancedBlendedMockFeedback(scene, mentors, characters) };
    }
  }
  
  /**
   * PRESERVED: Legacy single feedback method with cancellation support
   * NEW: Now supports token-aware requests when userId is provided
   */
  async generateFeedback(request: (AIFeedbackRequest | TokenAwareAIFeedbackRequest) & { mode?: 'structured' | 'scratchpad' }): Promise<AIFeedbackResponse | TokenAwareAIFeedbackResponse> {
    console.log('🔄 Legacy single feedback mode requested');
    
    try {
      // Check for cancellation
      if (request.abortSignal?.aborted) {
        throw new Error('Legacy feedback generation cancelled');
      }

      // Check if this is a token-aware request
      if ('userId' in request && request.userId) {
        console.log('🔄 Legacy request with token awareness, redirecting to token-aware dual feedback');
        const tokenAwareRequest = request as TokenAwareAIFeedbackRequest;
        
        // Always generate dual feedback, then extract the requested mode
        const dualResponse = await this.generateDualFeedback(tokenAwareRequest);
        
        // If specific mode requested, prioritize that content
        if (request.mode === 'scratchpad') {
          dualResponse.feedback.content = dualResponse.feedback.scratchpadContent;
        } else {
          dualResponse.feedback.content = dualResponse.feedback.structuredContent;
        }
        
        return dualResponse;
      } else {
        console.log('🔄 Legacy request without tokens, using original dual feedback');
        const originalRequest = request as AIFeedbackRequest;
        
        // Use original dual feedback generation
        const dualResponse = await this.performOriginalDualFeedback(originalRequest);
        
        // If specific mode requested, prioritize that content
        if (request.mode === 'scratchpad') {
          dualResponse.feedback.content = dualResponse.feedback.scratchpadContent;
        } else {
          dualResponse.feedback.content = dualResponse.feedback.structuredContent;
        }
        
        return dualResponse;
      }
    } catch (error: any) {
      if (request.abortSignal?.aborted || error.message?.includes('cancelled')) {
        throw new Error('Legacy feedback generation cancelled by user');
      }
      throw error;
    }
  }

  /**
   * PRESERVED: Generate script rewrite with cancellation support
   * NEW: Added token support when userId is provided
   */
  async generateScriptRewrite(
    scene: ScriptScene,
    feedback: Feedback,
    abortSignal?: AbortSignal,
    userId?: string
  ): Promise<ScriptRewrite | TokenAwareResponse<ScriptRewrite>> {
    console.log('✍️ Generating script rewrite with cancellation support...');

    try {
      // Check for cancellation before starting
      if (abortSignal?.aborted) {
        throw new Error('Script rewrite generation cancelled');
      }

      // If userId provided, handle token validation
      if (userId) {
        const tokenResult = await tokenService.processTokenTransaction(
          userId,
          'rewrite_suggestions',
          scene.id,
          feedback.mentorId,
          scene.id
        );

        if (!tokenResult.success) {
          const errorMessage = tokenResult.validation.hasEnoughTokens 
            ? 'Token deduction failed due to system error'
            : `Insufficient tokens for script rewrite. Need ${tokenResult.validation.requiredTokens}, have ${tokenResult.validation.currentBalance}`;
          
          return {
            success: false,
            error: errorMessage,
            tokenInfo: {
              tokensUsed: 0,
              remainingBalance: tokenResult.validation.currentBalance,
              action: 'rewrite_suggestions'
            }
          };
        }
      }

      // Simulate rewrite generation with cancellation checks
      const checkpoints = [25, 50, 75, 100];
      
      for (const checkpoint of checkpoints) {
        if (abortSignal?.aborted) {
          throw new Error('Script rewrite generation cancelled');
        }
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`✍️ Rewrite progress: ${checkpoint}%`);
      }

      // Generate the rewrite (this would use the backend in real implementation)
      const rewrite: ScriptRewrite = {
        id: `rewrite_${Date.now()}`,
        content: scene.content, // In real implementation, this would be the rewritten content
        changes: [
          'Tightened dialogue for better pacing',
          'Added visual action beats',
          'Enhanced character subtext'
        ],
        reasoning: 'Rewrite focuses on improving dialogue efficiency and visual storytelling based on mentor feedback.'
      };

      console.log('✅ Script rewrite generation completed');
      
      if (userId) {
        return {
          success: true,
          data: rewrite,
          tokenInfo: {
            tokensUsed: tokenService.getTokenCost('rewrite_suggestions'),
            remainingBalance: 0, // Would need to fetch updated balance
            action: 'rewrite_suggestions'
          }
        };
      }
      
      return rewrite;

    } catch (error: any) {
      if (abortSignal?.aborted || error.message?.includes('cancelled')) {
        console.log('🛑 Script rewrite generation was cancelled');
        
        if (userId) {
          return {
            success: false,
            error: 'Script rewrite generation cancelled by user',
            tokenInfo: {
              tokensUsed: 0,
              remainingBalance: 0,
              action: 'rewrite_suggestions'
            }
          };
        }
        
        throw new Error('Script rewrite generation cancelled by user');
      }
      
      console.error('❌ Script rewrite generation failed:', error);
      
      if (userId) {
        return {
          success: false,
          error: `Script rewrite generation failed: ${error.message}`,
          tokenInfo: {
            tokensUsed: tokenService.getTokenCost('rewrite_suggestions'),
            remainingBalance: 0,
            action: 'rewrite_suggestions'
          }
        };
      }
      
      throw error;
    }
  }

  /**
   * PRESERVED: Generate feedback using backend API for standard mentors
   */
  private async generateBackendFeedback(
    request: AIFeedbackRequest, 
    mode: 'structured' | 'scratchpad',
    characterContext: string,
    feedbackStyle: { systemPrompt: string; temperature: number }
  ): Promise<string> {
    try {
      console.log(`🚀 Generating ${mode} feedback via backend API for ${request.mentor.name} with cancellation support`);
      
      // Check for cancellation before backend call
      if (request.abortSignal?.aborted) {
        throw new Error(`${mode} feedback generation cancelled`);
      }
      
      const feedbackContent = await backendApiService.generateFeedback({
        scene_content: request.scene.content,
        mentor_id: request.mentor.id,
        character_context: characterContext,
        feedback_mode: mode,
        system_prompt: feedbackStyle.systemPrompt,
        temperature: feedbackStyle.temperature
      }, request.abortSignal);
      
      return this.cleanFeedbackContent(feedbackContent, mode, request.mentor);
    } catch (error: any) {
      // Handle cancellation
      if (request.abortSignal?.aborted || error.message?.includes('cancelled')) {
        throw new Error(`${mode} feedback generation cancelled`);
      }
      
      console.warn(`❌ Backend API failed for ${mode} feedback, using mock:`, error);
      return this.generateMockFeedback(request, mode);
    }
  }

  /**
   * PRESERVED: Generate blended feedback using backend API with special blended processing
   */
  private async generateBlendedBackendFeedback(
    request: AIFeedbackRequest,
    mode: 'structured' | 'scratchpad',
    characterContext: string,
    mentors: Mentor[],
    mentorWeights: Record<string, number>
  ): Promise<string> {
    try {
      console.log(`🎭 Generating blended ${mode} feedback via backend API with cancellation support`);
      
      // Check for cancellation before processing
      if (request.abortSignal?.aborted) {
        throw new Error(`Blended ${mode} feedback generation cancelled`);
      }
      
      // Create enhanced system prompt for blended feedback
      const blendedSystemPrompt = this.createBlendedSystemPrompt(mentors, mentorWeights, mode);
      
      const feedbackContent = await backendApiService.generateFeedback({
        scene_content: request.scene.content,
        mentor_id: 'blended',
        character_context: characterContext,
        feedback_mode: mode,
        system_prompt: blendedSystemPrompt,
        temperature: 0.7 // Balanced temperature for blended feedback
      }, request.abortSignal);
      
      return this.cleanBlendedFeedbackContent(feedbackContent, mode, mentors);
    } catch (error: any) {
      // Handle cancellation
      if (request.abortSignal?.aborted || error.message?.includes('cancelled')) {
        throw new Error(`Blended ${mode} feedback generation cancelled`);
      }
      
      console.warn(`❌ Blended backend API failed for ${mode} feedback, using mock:`, error);
      return this.generateBlendedMockFeedback(request, mode, mentors);
    }
  }

  /**
   * PRESERVED: Create system prompt for blended feedback
   */
  private createBlendedSystemPrompt(
    mentors: Mentor[],
    mentorWeights: Record<string, number>,
    mode: 'structured' | 'scratchpad'
  ): string {
    const mentorDescriptions = mentors.map(mentor => {
      const weight = mentorWeights[mentor.id] || 5;
      const weightPercentage = Math.round((weight / 10) * 100);
      return `${mentor.name} (${weightPercentage}% influence): ${mentor.tone} - ${mentor.styleNotes}`;
    }).join('\n');

    const basePrompt = `You are a blended AI mentor combining insights from multiple industry experts. 

MENTOR BLEND COMPOSITION:
${mentorDescriptions}

Your analysis should synthesize these perspectives, highlighting areas where mentors agree and noting where they might have different approaches. Provide comprehensive feedback that draws from each mentor's strengths while maintaining coherence.

BLENDED ANALYSIS APPROACH:
- Identify consensus points across mentoring styles
- Note where different approaches might yield different insights
- Provide balanced recommendations that consider multiple perspectives
- Maintain the distinct voice and expertise of each contributing mentor
- Create actionable advice that writers can implement

${mode === 'scratchpad' ? 
  'Format as informal, stream-of-consciousness notes that capture the collaborative thinking process of multiple mentors reviewing the script together.' :
  'Format as structured, comprehensive analysis organized by key screenplay elements (Structure, Dialogue, Character, Pacing, Theme) with clear actionable recommendations.'
}`;

    return basePrompt;
  }
  
  /**
   * PRESERVED: Clean feedback content for display
   */
  private cleanFeedbackContent(content: string, mode: 'structured' | 'scratchpad', mentor: Mentor): string {
    const cleanedContent = content.trim();
    return `${cleanedContent}\n\n"${mentor.mantra}"`;
  }

  /**
   * PRESERVED: Clean blended feedback content for display
   */
  private cleanBlendedFeedbackContent(content: string, mode: 'structured' | 'scratchpad', mentors: Mentor[]): string {
    const cleanedContent = content.trim();
    const blendedMantra = "Multiple perspectives reveal the full picture.";
    return `${cleanedContent}\n\n"${blendedMantra}"\n— Blended Mentoring Approach`;
  }
  
  /**
   * PRESERVED: Build character context with proper error handling and type checking
   */
  private buildCharacterContext(characters: Record<string, Character>): string {
    try {
      CharacterDataNormalizer.debugCharacterData(characters, 'aiFeedbackService.buildCharacterContext');
      const result = CharacterDataNormalizer.createCharacterContext(characters);
      console.log('📝 Built character context:', result || 'No character context available');
      return result;
    } catch (error) {
      console.error('❌ Error building character context:', error);
      try {
        const characterNames = Object.keys(characters || {}).filter(name => name && name.trim());
        if (characterNames.length > 0) {
          return `Characters present: ${characterNames.join(', ')}`;
        }
      } catch {
        // Even the fallback failed
      }
      return 'Character context unavailable due to processing error';
    }
  }
  
  /**
   * PRESERVED: Create dual feedback object
   */
  private createDualFeedbackObject(
    structuredContent: string, 
    scratchpadContent: string, 
    request: AIFeedbackRequest
  ): Feedback {
    const categories = this.extractCategoriesFromText(structuredContent);
    
    return {
      id: `dual-feedback-${Date.now()}`,
      mentorId: request.mentor.id,
      sceneId: request.scene.id,
      structuredContent,
      scratchpadContent,
      timestamp: new Date(),
      categories,
      content: structuredContent
    };
  }
  
  /**
   * PRESERVED: Extract categories from text
   */
  private extractCategoriesFromText(text: string): { structure: string; dialogue: string; pacing: string; theme: string } {
    const categories = {
      structure: '',
      dialogue: '',
      pacing: '',
      theme: ''
    };
    
    const sections = text.split(/###\s*/);
    
    sections.forEach(section => {
      const lines = section.split('\n').filter(line => line.trim());
      if (lines.length === 0) return;
      
      const header = lines[0].toLowerCase();
      const content = lines.slice(1).join(' ').trim();
      
      if (header.includes('structure')) {
        categories.structure = this.cleanCategoryContent(content);
      } else if (header.includes('dialogue')) {
        categories.dialogue = this.cleanCategoryContent(content);
      } else if (header.includes('pacing')) {
        categories.pacing = this.cleanCategoryContent(content);
      } else if (header.includes('theme')) {
        categories.theme = this.cleanCategoryContent(content);
      }
    });
    
    return categories;
  }
  
  /**
   * PRESERVED: Clean category content
   */
  private cleanCategoryContent(content: string): string {
    return content
      .replace(/^### /gm, '')
      .replace(/^\d+\.\s*/gm, '- ')
      .trim();
  }
  
  /**
   * PRESERVED: Generate mock feedback
   */
  private generateMockFeedback(request: AIFeedbackRequest, mode: 'structured' | 'scratchpad'): string {
    if (mode === 'scratchpad') {
      return this.generateEnhancedScratchpad(request);
    } else {
      return this.generateEnhancedStructured(request);
    }
  }

  /**
   * PRESERVED: Generate blended mock feedback
   */
  private generateBlendedMockFeedback(request: AIFeedbackRequest, mode: 'structured' | 'scratchpad', mentors: Mentor[]): string {
    const mentorNames = mentors.map(m => m.name).join(', ');
    
    if (mode === 'scratchpad') {
      return `## Blended Mentor Scratchpad\n\n### Multi-Perspective Analysis\n• Combining insights from: ${mentorNames}\n• Each mentor brings unique expertise to this scene\n• Looking for consensus and divergent viewpoints\n\n### Collaborative Observations\n• Scene shows potential from multiple angles\n• Different mentors might emphasize different strengths\n• Comprehensive analysis reveals layered opportunities\n\n"Multiple perspectives reveal the full picture."\n— Blended Mentoring Approach`;
    } else {
      return `## Blended Mentor Analysis\n\n### Multi-Perspective Structure\n• Analysis combines ${mentors.length} mentoring approaches\n• Consensus points and divergent insights identified\n• Comprehensive coverage of screenplay elements\n\n### Blended Recommendations\n• Structural improvements from multiple viewpoints\n• Character development across different mentoring styles\n• Dialogue enhancement using diverse approaches\n• Pacing optimization considering various perspectives\n\n### Actionable Synthesis\n• **Consensus Priority**: Areas where all mentors agree need attention\n• **Balanced Approach**: Recommendations that satisfy multiple mentoring styles\n• **Comprehensive Coverage**: Full spectrum analysis of screenplay craft\n\n"Multiple perspectives reveal the full picture."\n— Blended Mentoring Approach`;
    }
  }
  
  /**
   * PRESERVED: Generate enhanced dual feedback
   */
  private generateEnhancedDualFeedback(request: AIFeedbackRequest): Feedback {
    const structuredContent = this.generateEnhancedStructured(request);
    const scratchpadContent = this.generateEnhancedScratchpad(request);
    
    return this.createDualFeedbackObject(structuredContent, scratchpadContent, request);
  }

  /**
   * PRESERVED: Generate enhanced blended mock feedback
   */
  private generateEnhancedBlendedMockFeedback(
    scene: ScriptScene,
    mentors: Mentor[],
    characters: Record<string, Character>
  ): Feedback {
    const blendedRequest = {
      scene,
      mentor: {
        id: 'blended',
        name: 'Blended Mentors',
        tone: `Combined insights from: ${mentors.map(m => m.name).join(', ')}`,
        styleNotes: 'Multi-perspective analysis',
        avatar: 'https://images.pexels.com/photos/7102/notes-macbook-study-conference.jpg?auto=compress&cs=tinysrgb&w=600',
        accent: '#8b5cf6',
        mantra: 'Multiple perspectives reveal the full picture.',
        feedbackStyle: 'analytical' as const,
        priorities: ['multi-perspective-analysis'],
        analysisApproach: 'Blended approach'
      },
      characters
    };

    const structuredContent = this.generateBlendedMockFeedback(blendedRequest, 'structured', mentors);
    const scratchpadContent = this.generateBlendedMockFeedback(blendedRequest, 'scratchpad', mentors);
    
    return this.createDualFeedbackObject(structuredContent, scratchpadContent, blendedRequest);
  }
  
  /**
   * PRESERVED: Generate enhanced scratchpad feedback
   */
  private generateEnhancedScratchpad(request: AIFeedbackRequest): string {
    const mentorName = request.mentor.name.toUpperCase();
    const scene = request.scene.content;
    
    const hasSceneHeading = scene.includes('INT.') || scene.includes('EXT.');
    const hasDialogue = scene.split('\n').some(line => line.trim() && !line.includes('.') && line === line.toUpperCase());
    const wordCount = scene.split(' ').length;
    
    let notes = `## ${mentorName} Scratchpad\n\n`;
    
    const observations: string[] = [];
    const questions: string[] = [];
    
    if (!hasSceneHeading) {
      observations.push("Missing scene heading creates immediate disorientation for the reader");
    }
    
    if (wordCount > 200) {
      observations.push("Scene length suggests we might be trying to accomplish too much in one beat");
    }
    
    if (!hasDialogue) {
      observations.push("All action, no voice - are we missing character personality?");
    }
    
    switch (request.mentor.id) {
      case 'tony-gilroy':
        questions.push("What's the central conflict driving this moment forward?");
        questions.push("Could we start this scene 30 seconds later in the action?");
        questions.push("Who has the most to lose here, and are they driving the scene?");
        break;
      case 'sofia-coppola':
        questions.push("What's the emotional temperature of this moment?");
        questions.push("Where are the pauses that matter more than the words?");
        questions.push("What's being felt but deliberately left unsaid?");
        break;
      default:
        questions.push("What does each character want that they're not getting?");
        questions.push("Where's the hidden tension beneath the surface?");
    }
    
    if (observations.length > 0) {
      notes += "### Initial Observations\n\n";
      observations.forEach(obs => {
        notes += `• ${obs}\n`;
      });
      notes += "\n";
    }
    
    if (questions.length > 0) {
      notes += "### Questions to Explore\n\n";
      questions.forEach(q => {
        notes += `• ${q}\n`;
      });
    }
    
    notes += `\n"${request.mentor.mantra}"`;
    
    return notes;
  }
  
  /**
   * PRESERVED: Generate enhanced structured feedback
   */
  private generateEnhancedStructured(request: AIFeedbackRequest): string {
    const scene = request.scene.content;
    const mentor = request.mentor.name;
    
    let feedback = `## ${mentor} Analysis\n\n`;
    
    feedback += "### Structure\n\n";
    if (!scene.includes('INT.') && !scene.includes('EXT.')) {
      feedback += "• Scene lacks proper heading, creating immediate reader confusion\n";
    } else {
      feedback += "• Scene heading is properly formatted and establishes clear location\n";
    }
    
    if (scene.length < 100) {
      feedback += "• Scene feels underdeveloped and may need more dramatic weight\n";
    } else if (scene.length > 500) {
      feedback += "• Consider tightening - scene may be trying to accomplish too much\n";
    } else {
      feedback += "• Scene length feels appropriate for its dramatic purpose\n";
    }
    
    feedback += "\n### Dialogue\n\n";
    const dialogueLines = scene.split('\n').filter(line => 
      line.trim() && line === line.toUpperCase() && !line.includes('.')
    );
    
    if (dialogueLines.length === 0) {
      feedback += "• No dialogue present - consider if character voice is needed\n";
    } else if (dialogueLines.length < 3) {
      feedback += "• Limited dialogue - ensure each line reveals character or advances plot\n";
    } else {
      feedback += "• Dialogue present but check that each exchange has clear purpose\n";
    }
    
    feedback += "\n### Pacing\n\n";
    feedback += "• Consider the rhythm and flow of action versus dialogue beats\n";
    if (scene.includes('\n\n\n')) {
      feedback += "• Good use of white space to control pacing\n";
    } else {
      feedback += "• May benefit from more strategic use of paragraph breaks\n";
    }
    
    feedback += "\n### Theme\n\n";
    feedback += "• Ensure this scene serves the larger thematic arc of the story\n";
    feedback += "• Look for opportunities to layer in deeper meaning through subtext\n";
    
    feedback += "\n### Actionable Advice\n\n";
    feedback += "• **Enhance Visual Impact**: Add specific details that help readers visualize the space\n";
    feedback += "• **Sharpen Character Objectives**: Make sure each character's want is clear and active\n";
    feedback += "• **Deepen Subtext**: Look for what characters aren't saying but are feeling\n";
    
    feedback += `\n"${request.mentor.mantra}"`;
    
    return feedback;
  }

  /**
   * NEW: Create empty feedback for error cases
   */
  private createEmptyFeedback(scene: ScriptScene, mentor: Mentor): Feedback {
    return {
      id: `error_feedback_${Date.now()}`,
      mentorId: mentor.id,
      sceneId: scene.id,
      structuredContent: 'Feedback generation failed. Please try again.',
      scratchpadContent: 'Unable to generate feedback at this time.',
      timestamp: new Date(),
      categories: {
        structure: 'Error',
        dialogue: 'Error', 
        pacing: 'Error',
        theme: 'Error'
      }
    };
  }

  /**
   * NEW: Public validation methods for token checking
   */
  async validateTokensForFeedback(userId: string, actionType: 'single_feedback' | 'blended_feedback'): Promise<{
    canProceed: boolean;
    cost: number;
    currentBalance: number;
    shortfall?: number;
  }> {
    try {
      const cost = tokenService.getTokenCost(actionType);
      const validation = await tokenService.validateTokenBalance(userId, cost);
      
      return {
        canProceed: validation.hasEnoughTokens,
        cost,
        currentBalance: validation.currentBalance,
        shortfall: validation.shortfall
      };
    } catch (error) {
      console.error('Error validating tokens for feedback:', error);
      return {
        canProceed: false,
        cost: tokenService.getTokenCost(actionType),
        currentBalance: 0
      };
    }
  }

  /**
   * NEW: Get token cost for feedback type
   */
  getTokenCost(actionType: 'single_feedback' | 'blended_feedback'): number {
    return tokenService.getTokenCost(actionType);
  }
}

export const aiFeedbackService = new AIFeedbackService();