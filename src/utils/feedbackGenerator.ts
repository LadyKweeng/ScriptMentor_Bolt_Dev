// src/utils/feedbackGenerator.ts - Comprehensive version with enhanced blended feedback support
import { 
  Mentor, 
  ScriptScene, 
  Feedback, 
  FeedbackMode, 
  MentorWeights,
  FullScript,
  Character
} from '../types';
import { CharacterMemoryManager } from './characterMemory';
import { EnhancedMentorFeedbackService } from '../services/enhancedMentorFeedbackService';
import { aiFeedbackService } from '../services/aiFeedbackService';
// Import chunked feedback service
import { FeedbackChunkService, ChunkProcessingProgress } from '../services/feedbackChunkService';

export class FeedbackGenerator {
  private characterManager: CharacterMemoryManager;
  private enhancedService: EnhancedMentorFeedbackService;
  private chunkService: FeedbackChunkService;
  
  constructor(characterManager: CharacterMemoryManager) {
    this.characterManager = characterManager;
    this.enhancedService = new EnhancedMentorFeedbackService();
    this.chunkService = new FeedbackChunkService();
  }
  
  /**
   * Generate chunked feedback for a full script
   */
  async generateChunkedFeedback(
    fullScript: FullScript,
    mentor: Mentor,
    onProgress?: (progress: ChunkProcessingProgress) => void
  ): Promise<Feedback> {
    console.log('🚀 Generating chunked feedback:', {
      mentor: mentor.name,
      chunkCount: fullScript.chunks.length,
      strategy: fullScript.chunkingStrategy
    });

    try {
      const chunkedFeedback = await this.chunkService.generateChunkedFeedback(
        fullScript.chunks,
        mentor,
        fullScript.characters,
        onProgress
      );

      // Create a Feedback object that contains the chunked feedback
      return {
        id: `chunked_feedback_${Date.now()}`,
        mentorId: mentor.id,
        sceneId: fullScript.id,
        structuredContent: this.createChunkedSummary(chunkedFeedback, 'structured'),
        scratchpadContent: this.createChunkedSummary(chunkedFeedback, 'scratchpad'),
        timestamp: new Date(),
        categories: {
          structure: 'Multi-section analysis',
          dialogue: 'Character development across script',
          pacing: 'Overall rhythm and flow',
          theme: 'Thematic consistency'
        },
        content: this.createChunkedSummary(chunkedFeedback, 'structured'), // Legacy field
        isChunked: true,
        chunkedFeedback
      };
    } catch (error) {
      console.error('❌ Chunked feedback generation failed:', error);
      throw error;
    }
  }

  /**
   * Create a summary of chunked feedback for the legacy content field
   */
  private createChunkedSummary(chunkedFeedback: any, mode: 'structured' | 'scratchpad'): string {
    const chunkCount = chunkedFeedback.chunks.length;
    const summary = chunkedFeedback.summary;
    
    let summaryText = `## ${mode === 'scratchpad' ? 'Script Notes' : 'Script Analysis'} - ${chunkCount} Sections\n\n`;
    
    if (summary?.overallStructure) {
      summaryText += `### Overall Structure\n${summary.overallStructure}\n\n`;
    }
    
    if (summary?.keyStrengths?.length > 0) {
      summaryText += `### Key Strengths\n`;
      summary.keyStrengths.forEach((strength: string) => {
        summaryText += `• ${strength}\n`;
      });
      summaryText += '\n';
    }
    
    if (summary?.majorIssues?.length > 0) {
      summaryText += `### Areas for Improvement\n`;
      summary.majorIssues.forEach((issue: string) => {
        summaryText += `• ${issue}\n`;
      });
      summaryText += '\n';
    }
    
    if (summary?.globalRecommendations?.length > 0) {
      summaryText += `### Global Recommendations\n`;
      summary.globalRecommendations.forEach((rec: string) => {
        summaryText += `• ${rec}\n`;
      });
    }
    
    return summaryText;
  }
  
  /**
   * Generate both structured and scratchpad feedback simultaneously
   * Enhanced with GPT-4o powered system and comprehensive fallbacks
   */
  async generateDualFeedback(
    scene: ScriptScene, 
    mentor: Mentor
  ): Promise<Feedback> {
    console.log('🎯 Using Enhanced Mentor Feedback System v2.0', {
      scene: scene.title,
      mentor: mentor.name,
      sceneLength: scene.content.length,
      enhancedCapabilities: true
    });
    
    // Extract characters and update memory
    const characters = this.characterManager.extractCharactersFromScene(scene.content);
    characters.forEach(character => {
      if (!this.characterManager.getMemory(character)) {
        this.characterManager.updateMemory(character, `Character introduced in scene: ${scene.title}`);
      }
    });
    
    try {
      // Use enhanced service for GPT-4o powered analysis
      console.log('🧠 Calling Enhanced Mentor Feedback Service...');
      const enhancedFeedback = await this.enhancedService.generateEnhancedFeedback(
        scene,
        mentor,
        this.characterManager.getAllCharacters()
      );
      
      console.log('✅ Enhanced feedback generated successfully', {
        structuredLength: enhancedFeedback.structuredContent.length,
        scratchpadLength: enhancedFeedback.scratchpadContent.length,
        hasSpecificReferences: enhancedFeedback.structuredContent.includes('line') || 
          enhancedFeedback.structuredContent.includes('Line')
      });
      
      return enhancedFeedback;
      
    } catch (error) {
      console.warn('🔄 Enhanced feedback failed, trying fallback service...', error);
      
      try {
        // Fallback to existing AI service
        const aiResponse = await aiFeedbackService.generateDualFeedback({
          scene,
          mentor,
          characters: this.characterManager.getAllCharacters()
        });
        
        console.log('✅ Fallback AI service succeeded');
        return aiResponse.feedback;
        
      } catch (fallbackError) {
        console.warn('🔄 AI service also failed, using enhanced mock...', fallbackError);
        
        // Final fallback to enhanced mock feedback
        return this.generateEnhancedDualMockFeedback(scene, mentor);
      }
    }
  }
  
  /**
   * Legacy method for backward compatibility
   * Now internally generates dual feedback but returns based on mode
   */
  async generateFeedback(
    scene: ScriptScene, 
    mentor: Mentor, 
    mode: FeedbackMode = 'structured'
  ): Promise<Feedback> {
    console.log('📝 Legacy feedback method called, upgrading to dual feedback...');
    
    // Generate dual feedback using enhanced system
    const dualFeedback = await this.generateDualFeedback(scene, mentor);
    
    // For backward compatibility, set the legacy content field based on mode
    if (mode === 'scratchpad') {
      dualFeedback.content = dualFeedback.scratchpadContent;
    } else {
      dualFeedback.content = dualFeedback.structuredContent;
    }
    
    return dualFeedback;
  }
  
  /**
   * Enhanced blend feedback from multiple mentors with comprehensive error handling
   * Supports both single scenes and chunked scripts
   */
  async blendFeedback(scene: ScriptScene, mentors: Mentor[], weights: MentorWeights): Promise<Feedback> {
    console.log('🎯 Blending mentor feedback with enhanced error handling...', {
      mentorCount: mentors.length,
      weights,
      mentorNames: mentors.map(m => m.name),
      sceneType: scene.id.includes('chunk') ? 'chunk' : 'scene',
      usingEnhancedGeneration: true
    });
    
    try {
      // Try to use backend API for blended feedback
      const blendedFeedback = await this.generateBlendedFeedbackUsingBackendAPI(scene, mentors, weights);
      
      console.log('✅ Blended feedback generated successfully using backend API', {
        structuredLength: blendedFeedback.structuredContent?.length || 0,
        scratchpadLength: blendedFeedback.scratchpadContent?.length || 0,
        hasContent: !!(blendedFeedback.structuredContent || blendedFeedback.content)
      });
      
      return blendedFeedback;
      
    } catch (error) {
      console.warn('🔄 Backend API failed for blended feedback, using enhanced local generation...', error);
      
      // Fallback to enhanced local blending logic
      return this.generateEnhancedLocalBlendedFeedback(scene, mentors, weights);
    }
  }
  
  /**
   * Generate blended feedback using backend API with comprehensive error handling
   */
  private async generateBlendedFeedbackUsingBackendAPI(
    scene: ScriptScene, 
    mentors: Mentor[], 
    weights: MentorWeights
  ): Promise<Feedback> {
    const backendUrl = 'https://smbackend-production.up.railway.app/api';
    
    // Calculate total weight for normalization
    const totalWeight = mentors.reduce((sum, mentor) => sum + (weights[mentor.id] || 1), 0);
    
    // Create weighted mentor descriptions
    const mentorDescriptions = mentors.map(mentor => {
      const percentage = Math.round(((weights[mentor.id] || 1) / totalWeight) * 100);
      return `${mentor.name} (${percentage}% influence): ${mentor.tone}. Priorities: ${mentor.priorities?.join(', ') || 'General feedback'}`;
    }).join('\n');
    
    // Build character context
    const characterContext = this.buildCharacterContext();
    
    // Create enhanced blended system prompt
    const systemPrompt = `You are a blended AI mentor combining the perspectives of multiple screenplay experts.

MENTOR BLEND:
${mentorDescriptions}

Your task is to provide comprehensive feedback that reflects the weighted combination of these mentors' approaches. Higher percentage mentors should have more influence on your analysis style and priorities.

Blend their voices naturally - don't just list separate opinions, but create a cohesive analysis that draws from each mentor's strengths according to their weight.

Character Context:
${characterContext}

Provide detailed structured feedback with clear sections for Structure, Dialogue, Pacing, and Recommendations. Make the feedback substantial and actionable.`;

    console.log('🚀 Sending blended feedback request using enhanced prompt...', {
      url: `${backendUrl}/generate-feedback`,
      mentorCount: mentors.length,
      sceneLength: scene.content.length,
      promptLength: systemPrompt.length
    });
    
    try {
      // Generate structured feedback
      const structuredResponse = await fetch(`${backendUrl}/generate-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scene_content: scene.content,
          mentor_id: 'blended',
          character_context: characterContext,
          feedback_mode: 'structured',
          system_prompt: systemPrompt,
          temperature: 0.7
        })
      });
      
      if (!structuredResponse.ok) {
        const errorData = await structuredResponse.json().catch(() => ({}));
        throw new Error(`Backend API Error: ${structuredResponse.status} - ${errorData.error || structuredResponse.statusText}`);
      }
      
      const structuredData = await structuredResponse.json();
      
      if (!structuredData.success || !structuredData.feedback) {
        throw new Error('Backend API returned empty structured feedback');
      }
      
      // Generate scratchpad feedback
      const scratchpadPrompt = `You are the same blended mentor combining: ${mentors.map(m => m.name).join(', ')}.

Provide quick, unfiltered brainstorming notes (4-6 bullet points) that blend their different approaches and instincts.

Scene: ${scene.content}

Give raw, honest observations and questions that combine their perspectives according to their influence weights.`;

      const scratchpadResponse = await fetch(`${backendUrl}/generate-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scene_content: scene.content,
          mentor_id: 'blended',
          character_context: characterContext,
          feedback_mode: 'scratchpad',
          system_prompt: scratchpadPrompt,
          temperature: 0.9
        })
      });
      
      let scratchpadContent = '';
      if (scratchpadResponse.ok) {
        const scratchpadData = await scratchpadResponse.json();
        if (scratchpadData.success && scratchpadData.feedback) {
          scratchpadContent = scratchpadData.feedback;
        }
      }
      
      // If scratchpad failed, generate fallback
      if (!scratchpadContent) {
        scratchpadContent = this.generateBlendedScratchpad(mentors, weights);
      }
      
      // Create feedback object with proper content - CRITICAL FIX
      const blendedFeedback: Feedback = {
        id: `blended-feedback-${Date.now()}`,
        mentorId: 'blended',
        sceneId: scene.id,
        structuredContent: structuredData.feedback,
        scratchpadContent: scratchpadContent,
        timestamp: new Date(),
        categories: this.extractCategoriesFromText(structuredData.feedback),
        content: structuredData.feedback // Legacy field - set to structured content
      };
      
      console.log('✅ Blended feedback created with content:', {
        structuredLength: blendedFeedback.structuredContent.length,
        scratchpadLength: blendedFeedback.scratchpadContent.length,
        hasCategories: Object.keys(blendedFeedback.categories).length > 0
      });
      
      return blendedFeedback;
      
    } catch (apiError) {
      console.error('❌ Backend API request failed:', apiError);
      throw apiError;
    }
  }
  
  /**
   * Enhanced local blended feedback generation as comprehensive fallback
   */
  private generateEnhancedLocalBlendedFeedback(
    scene: ScriptScene, 
    mentors: Mentor[], 
    weights: MentorWeights
  ): Feedback {
    console.log('🎭 Generating enhanced local blended feedback with full analysis...');
    
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const mentorNames = mentors.map(m => m.name).join(', ');
    
    // Generate comprehensive blended structured content with script analysis
    const blendedStructured = this.generateComprehensiveBlendedStructuredContent(scene, mentors, weights);
    const blendedScratchpad = this.generateComprehensiveBlendedScratchpadContent(scene, mentors, weights);
    
    const feedback: Feedback = {
      id: `enhanced-local-blended-feedback-${Date.now()}`,
      mentorId: 'blended',
      sceneId: scene.id,
      structuredContent: blendedStructured,
      scratchpadContent: blendedScratchpad,
      timestamp: new Date(),
      categories: this.extractCategoriesFromText(blendedStructured),
      content: blendedStructured // Legacy field - set to structured content
    };
    
    console.log('✅ Enhanced local blended feedback generated:', {
      structuredLength: feedback.structuredContent.length,
      scratchpadLength: feedback.scratchpadContent.length,
      mentorCount: mentors.length,
      hasScriptAnalysis: feedback.structuredContent.includes('Line') || feedback.structuredContent.includes('character')
    });
    
    return feedback;
  }
  
  /**
   * Generate comprehensive blended structured content with script-specific analysis
   */
  private generateComprehensiveBlendedStructuredContent(
    scene: ScriptScene, 
    mentors: Mentor[], 
    weights: MentorWeights
  ): string {
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const mentorNames = mentors.map(m => m.name).join(', ');
    
    // Analyze script characteristics for blended analysis
    const sceneContent = scene.content;
    const lines = sceneContent.split('\n');
    const hasSceneHeading = sceneContent.match(/^(INT\.|EXT\.)/m);
    const dialogueLines = lines.filter(line => 
      line.trim() && line === line.toUpperCase() && !line.includes('.') && line.length < 40
    );
    const actionLines = lines.filter(line => 
      line.trim() && line !== line.toUpperCase() && !line.includes('(')
    );
    
    let content = `## Blended Mentor Analysis\n\n`;
    content += `*Enhanced feedback combining insights from ${mentors.length} selected mentors*\n\n`;
    content += `**Mentor Blend**: ${mentorNames}\n`;
    content += `**Weighting**: ${Object.entries(weights).map(([id, weight]) => {
      const mentor = mentors.find(m => m.id === id);
      const percentage = Math.round((weight / totalWeight) * 100);
      return `${mentor?.name} (${percentage}%)`;
    }).join(', ')}\n\n`;
    
    // Structure analysis based on dominant mentor with script specifics
    const dominantMentor = mentors.reduce((prev, current) => 
      (weights[current.id] || 0) > (weights[prev.id] || 0) ? current : prev
    );
    
    content += "### Structure\n\n";
    content += this.getEnhancedStructuralAdvice(scene, dominantMentor, mentors, weights, {
      hasSceneHeading: !!hasSceneHeading,
      sceneLength: sceneContent.length,
      lineCount: lines.length
    });
    
    content += "\n### Dialogue\n\n";
    content += this.getEnhancedDialogueAdvice(scene, mentors, weights, {
      dialogueCount: dialogueLines.length,
      hasParentheticals: sceneContent.includes('(') && sceneContent.includes(')')
    });
    
    content += "\n### Pacing\n\n";
    content += this.getEnhancedPacingAdvice(scene, mentors, weights, {
      actionToDialogueRatio: actionLines.length / (dialogueLines.length || 1),
      sceneLength: sceneContent.length
    });
    
    content += "\n### Blended Recommendations\n\n";
    content += this.getEnhancedBlendedRecommendations(scene, mentors, weights);
    
    content += `\n### Collective Wisdom\n\n`;
    content += `"${this.getBlendedMantra(mentors, weights)}"\n`;
    content += `*— Combined insights from ${mentorNames}*`;
    
    return content;
  }
  
  /**
   * Generate comprehensive blended scratchpad content with script reactions
   */
  private generateComprehensiveBlendedScratchpadContent(
    scene: ScriptScene, 
    mentors: Mentor[], 
    weights: MentorWeights
  ): string {
    const mentorNames = mentors.map(m => m.name).join(', ');
    const sceneContent = scene.content;
    const lines = sceneContent.split('\n');
    
    let content = `## Blended Mentor Scratchpad\n\n`;
    content += `*Collective brainstorming from ${mentors.length} mentors*\n\n`;
    
    // Initial script reactions from different perspectives
    content += "### Initial Reactions\n\n";
    const firstLine = lines.find(line => line.trim())?.trim() || '';
    if (firstLine) {
      mentors.forEach(mentor => {
        const weight = weights[mentor.id] || 1;
        const influence = weight > 7 ? 'Strong' : weight > 4 ? 'Moderate' : 'Light';
        content += `• **${mentor.name}** (${influence}): ${this.getMentorReaction(mentor, firstLine, scene)}\n`;
      });
    }
    
    content += "\n### Collective Observations\n\n";
    const observations = this.generateBlendedObservations(mentors, weights, scene);
    observations.forEach(obs => {
      content += `• ${obs}\n`;
    });
    
    content += "\n### Blended Questions\n\n";
    const questions = this.generateEnhancedBlendedQuestions(mentors, weights, scene);
    questions.forEach(q => {
      content += `• ${q}\n`;
    });
    
    content += "\n### Quick Instincts\n\n";
    content += `• **Dominant Voice**: ${this.getDominantMentorInstinct(mentors, weights, scene)}\n`;
    content += `• **Secondary Perspective**: ${this.getSecondaryMentorInstinct(mentors, weights, scene)}\n`;
    content += `• **Collective Hunch**: ${this.getCollectiveHunch(mentors, weights, scene)}\n`;
    
    content += `\n**Voices**: Combined instincts from ${mentorNames}`;
    
    return content;
  }
  
  /**
   * Get enhanced structural advice with script analysis
   */
  private getEnhancedStructuralAdvice(
    scene: ScriptScene, 
    dominantMentor: Mentor, 
    mentors: Mentor[], 
    weights: MentorWeights,
    analysis: { hasSceneHeading: boolean; sceneLength: number; lineCount: number }
  ): string {
    let advice = '';
    
    // Script-specific structural observations
    if (!analysis.hasSceneHeading) {
      advice += "• **Missing Scene Heading**: Opening lacks proper INT./EXT. formatting - readers need immediate orientation\n";
    }
    
    if (analysis.sceneLength > 500) {
      advice += "• **Scene Length**: This scene might be handling multiple story beats - consider focus\n";
    }
    
    // Primary advice from dominant mentor
    switch (dominantMentor.id) {
      case 'tony-gilroy':
        advice += "• **Structural Efficiency**: Test scene necessity - what breaks if we cut this?\n";
        advice += "• **Story Engine**: Ensure every element serves the central narrative drive\n";
        break;
      case 'sofia-coppola':
        advice += "• **Atmospheric Structure**: Focus on emotional architecture over plot mechanics\n";
        advice += "• **Organic Flow**: Trust natural scene rhythms rather than forced beats\n";
        break;
      case 'vince-gilligan':
        advice += "• **Character-Driven Structure**: Ensure structure serves character psychology\n";
        advice += "• **Consequence Setup**: Plant elements for future character complications\n";
        break;
      case 'amy-pascal':
        advice += "• **Accessible Structure**: Balance sophistication with clear story progression\n";
        advice += "• **Universal Appeal**: Structure should serve broad audience engagement\n";
        break;
      case 'netflix-exec':
        advice += "• **Engagement Structure**: Optimize for modern viewing patterns and hooks\n";
        advice += "• **Forward Momentum**: Each beat should pull toward the next scene\n";
        break;
    }
    
    // Add secondary perspectives from other mentors
    const secondaryMentors = mentors.filter(m => m.id !== dominantMentor.id && (weights[m.id] || 0) > 3);
    if (secondaryMentors.length > 0) {
      const highestSecondary = secondaryMentors.reduce((prev, current) => 
        (weights[current.id] || 0) > (weights[prev.id] || 0) ? current : prev
      );
      
      advice += `• **Secondary Perspective (${highestSecondary.name})**: ${this.getSecondaryStructuralNote(scene, highestSecondary)}\n`;
    }
    
    return advice;
  }
  
  /**
   * Get enhanced dialogue advice with script analysis
   */
  private getEnhancedDialogueAdvice(
    scene: ScriptScene, 
    mentors: Mentor[], 
    weights: MentorWeights,
    analysis: { dialogueCount: number; hasParentheticals: boolean }
  ): string {
    let advice = '';
    
    if (analysis.dialogueCount === 0) {
      advice += "• **No Dialogue Present**: This is purely visual storytelling - consider if character voice would enhance the moment\n";
    } else {
      advice += `• **Character Count**: ${analysis.dialogueCount} speakers identified in this scene\n`;
      
      if (!analysis.hasParentheticals) {
        advice += "• **Character Direction**: No parentheticals present - consider where actor guidance might enhance clarity\n";
      }
    }
    
    // Blend dialogue advice based on mentor weights
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    
    mentors.forEach(mentor => {
      const weight = weights[mentor.id] || 0;
      const influence = weight / totalWeight;
      
      if (influence > 0.25) { // Only include mentors with significant influence
        advice += `• **${mentor.name}'s Perspective**: ${this.getDialogueAdviceForMentor(scene, mentor)}\n`;
      }
    });
    
    return advice;
  }
  
  /**
   * Get enhanced pacing advice with script analysis
   */
  private getEnhancedPacingAdvice(
    scene: ScriptScene, 
    mentors: Mentor[], 
    weights: MentorWeights,
    analysis: { actionToDialogueRatio: number; sceneLength: number }
  ): string {
    let advice = '';
    
    // Script-specific pacing observations
    if (analysis.actionToDialogueRatio > 3) {
      advice += "• **Action Heavy**: High ratio of description to dialogue - ensure visual details drive story forward\n";
    } else if (analysis.actionToDialogueRatio < 0.5) {
      advice += "• **Dialogue Heavy**: More talk than action - consider balancing with visual storytelling moments\n";
    }
    
    // Combine pacing insights from all mentors
    const pacingInsights = mentors.map(mentor => {
      const weight = weights[mentor.id] || 0;
      return {
        mentor: mentor.name,
        weight,
        insight: this.getPacingInsightForMentor(scene, mentor)
      };
    }).filter(item => item.weight > 2);
    
    pacingInsights.forEach(item => {
      advice += `• **${item.mentor}**: ${item.insight}\n`;
    });
    
    return advice;
  }
  
  /**
   * Get enhanced blended recommendations with script awareness
   */
  private getEnhancedBlendedRecommendations(
    scene: ScriptScene, 
    mentors: Mentor[], 
    weights: MentorWeights
  ): string {
    let recommendations = '';
    
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const dominantMentor = mentors.reduce((prev, current) => 
      (weights[current.id] || 0) > (weights[prev.id] || 0) ? current : prev
    );
    
    // Generate script-specific recommendations
    recommendations += "• **Primary Focus**: ";
    recommendations += `Follow ${dominantMentor.name}'s approach as the primary lens for revision\n`;
    
    recommendations += "• **Script-Specific Actions**: ";
    const sceneLength = scene.content.length;
    if (sceneLength > 400) {
      recommendations += `Consider breaking this ${sceneLength}-character scene into focused beats\n`;
    } else {
      recommendations += "Scene length is focused - enhance specificity and detail\n";
    }
    
    recommendations += "• **Secondary Considerations**: ";
    const secondaryMentors = mentors
      .filter(m => m.id !== dominantMentor.id)
      .filter(m => (weights[m.id] || 0) / totalWeight > 0.2);
    
    if (secondaryMentors.length > 0) {
      recommendations += `Incorporate ${secondaryMentors.map(m => m.name).join(' and ')} insights for comprehensive revision\n`;
    } else {
      recommendations += "Focus primarily on dominant mentor's perspective for consistency\n";
    }
    
    recommendations += "• **Blended Action Items**: ";
    recommendations += this.getSpecificActionItems(scene, mentors, weights);
    
    return recommendations;
  }
  
  /**
   * Generate specific action items based on blended mentor analysis
   */
  private getSpecificActionItems(scene: ScriptScene, mentors: Mentor[], weights: MentorWeights): string {
    const dominantMentor = mentors.reduce((prev, current) => 
      (weights[current.id] || 0) > (weights[prev.id] || 0) ? current : prev
    );
    
    const items = [];
    
    // Add dominant mentor's primary action
    switch (dominantMentor.id) {
      case 'tony-gilroy':
        items.push('Identify and eliminate any non-essential elements');
        break;
      case 'sofia-coppola':
        items.push('Add atmospheric details that reflect character emotions');
        break;
      case 'vince-gilligan':
        items.push('Ground character choices in established psychology');
        break;
      case 'amy-pascal':
        items.push('Ensure universal emotional accessibility');
        break;
      case 'netflix-exec':
        items.push('Optimize opening and ending for maximum engagement');
        break;
    }
    
    // Add secondary actions from other mentors
    const secondaryMentors = mentors.filter(m => m.id !== dominantMentor.id && (weights[m.id] || 0) > 4);
    if (secondaryMentors.length > 0) {
      const highestSecondary = secondaryMentors.reduce((prev, current) => 
        (weights[current.id] || 0) > (weights[prev.id] || 0) ? current : prev
      );
      
      switch (highestSecondary.id) {
        case 'tony-gilroy':
          items.push('test scene necessity');
          break;
        case 'sofia-coppola':
          items.push('trust subtext over exposition');
          break;
        case 'vince-gilligan':
          items.push('deepen character psychology');
          break;
        case 'amy-pascal':
          items.push('strengthen audience connection');
          break;
        case 'netflix-exec':
          items.push('enhance forward momentum');
          break;
      }
    }
    
    return items.join(', then ') + '\n';
  }
  
  /**
   * Generate mentor-specific reactions to opening lines
   */
  private getMentorReaction(mentor: Mentor, firstLine: string, scene: ScriptScene): string {
    const reactions = {
      'tony-gilroy': `"${firstLine}" - Does this immediately serve the story engine?`,
      'sofia-coppola': `"${firstLine}" - What's the emotional temperature here?`,
      'vince-gilligan': `"${firstLine}" - How does this reveal character psychology?`,
      'amy-pascal': `"${firstLine}" - Will audiences immediately connect?`,
      'netflix-exec': `"${firstLine}" - Does this hook viewers from line one?`
    };
    
    return reactions[mentor.id] || `"${firstLine}" - How does this serve the scene?`;
  }
  
  /**
   * Generate blended observations with script analysis
   */
  private generateBlendedObservations(mentors: Mentor[], weights: MentorWeights, scene: ScriptScene): string[] {
    const observations = [];
    const sceneContent = scene.content;
    const lines = sceneContent.split('\n');
    
    // Scene length observation
    if (sceneContent.length > 500) {
      observations.push('Scene runs long - multiple mentors agree this might be handling too many beats');
    }
    
    // Dialogue density observation
    const dialogueLines = lines.filter(line => 
      line.trim() && line === line.toUpperCase() && !line.includes('.') && line.length < 40
    );
    
    if (dialogueLines.length > 8) {
      observations.push('Dialogue-heavy scene - consider visual storytelling opportunities');
    } else if (dialogueLines.length === 0) {
      observations.push('Silent scene - strong visual storytelling opportunity');
    }
    
    // Character count observation
    if (dialogueLines.length > 4) {
      observations.push('Multiple characters present - ensure each has a clear scene objective');
    }
    
    // Add mentor-specific observations
    const dominantMentor = mentors.reduce((prev, current) => 
      (weights[current.id] || 0) > (weights[prev.id] || 0) ? current : prev
    );
    
    observations.push(`${dominantMentor.name}'s lens: ${this.getMentorObservation(dominantMentor, scene)}`);
    
    return observations.slice(0, 4);
  }
  
  /**
   * Generate enhanced blended questions with script awareness
   */
  private generateEnhancedBlendedQuestions(mentors: Mentor[], weights: MentorWeights, scene: ScriptScene): string[] {
    const questions: string[] = [];
    const sceneContent = scene.content;
    
    // Add script-specific questions
    if (sceneContent.length > 400) {
      questions.push('Could this scene be split into more focused dramatic beats?');
    }
    
    if (!sceneContent.match(/^(INT\.|EXT\.)/m)) {
      questions.push('Would proper scene heading improve reader orientation?');
    }
    
    // Add mentor-specific questions based on weights
    mentors.forEach(mentor => {
      const weight = weights[mentor.id] || 0;
      if (weight > 4) { // Only include questions from mentors with significant weight
        questions.push(this.getEnhancedQuestionForMentor(mentor, scene));
      }
    });
    
    return questions.slice(0, 5); // Limit to 5 questions
  }
  
  /**
   * Get enhanced questions with script context
   */
  private getEnhancedQuestionForMentor(mentor: Mentor, scene: ScriptScene): string {
    const sceneLength = scene.content.length;
    const questions = {
      'tony-gilroy': sceneLength > 400 ? 
        'What would break if we cut this scene in half?' : 
        'What would break if we cut this scene entirely?',
      'sofia-coppola': 'What\'s the emotional subtext beneath the surface action?',
      'vince-gilligan': 'How do character flaws drive the conflict in this specific moment?',
      'amy-pascal': 'What makes this situation relatable to anyone who\'s never experienced it?',
      'netflix-exec': sceneLength > 300 ? 
        'Where might modern viewers lose interest and need a hook?' : 
        'How does this pull viewers toward the next scene?'
    };
    
    return questions[mentor.id] || 'How can this scene be more dramatically effective?';
  }
  
  /**
   * Build character context for API requests
   */
  private buildCharacterContext(): string {
    const characters = this.characterManager.getAllCharacters();
    const contextBlocks: string[] = [];
    
    Object.entries(characters).forEach(([name, character]) => {
      const notes = character.notes.join('. ');
      if (notes.trim()) {
        contextBlocks.push(`${name}: ${notes}`);
      }
    });
    
    return contextBlocks.join('\n');
  }
  
  /**
   * Generate blended scratchpad content (fallback version)
   */
  private generateBlendedScratchpad(mentors: Mentor[], weights: MentorWeights): string {
    const mentorNames = mentors.map(m => m.name).join(', ');
    
    let content = `## Blended Mentor Scratchpad\n\n`;
    content += `*Collective brainstorming from ${mentors.length} mentors*\n\n`;
    
    content += "### Collective Observations\n\n";
    mentors.forEach(mentor => {
      const weight = weights[mentor.id] || 1;
      const influence = weight > 7 ? 'Strong' : weight > 4 ? 'Moderate' : 'Light';
      content += `• **${mentor.name}** (${influence} influence): ${this.getMentorObservation(mentor)}\n`;
    });
    
    content += "\n### Blended Questions\n\n";
    const questions = this.generateBlendedQuestions(mentors, weights);
    questions.forEach(q => {
      content += `• ${q}\n`;
    });
    
    content += `\n**Voices**: Combined instincts from ${mentorNames}`;
    
    return content;
  }
  
  // Helper methods for generating mentor-specific content
  private getMentorObservation(mentor: Mentor, scene?: ScriptScene): string {
    const observations = {
      'tony-gilroy': 'What\'s the essential story engine here?',
      'sofia-coppola': 'How does this moment feel emotionally?',
      'vince-gilligan': 'What character psychology drives this scene?',
      'amy-pascal': 'Will audiences connect with this moment?',
      'netflix-exec': 'Does this hook viewers for the next beat?'
    };
    
    return observations[mentor.id] || 'What makes this scene essential?';
  }
  
  private generateBlendedQuestions(mentors: Mentor[], weights: MentorWeights, scene?: ScriptScene): string[] {
    const questions: string[] = [];
    
    mentors.forEach(mentor => {
      const weight = weights[mentor.id] || 0;
      if (weight > 3) {
        questions.push(this.getQuestionForMentor(mentor));
      }
    });
    
    return questions.slice(0, 4);
  }
  
  private getQuestionForMentor(mentor: Mentor): string {
    const questions = {
      'tony-gilroy': 'What would break if we cut this scene entirely?',
      'sofia-coppola': 'What\'s the emotional subtext beneath the surface?',
      'vince-gilligan': 'How do character flaws drive this conflict?',
      'amy-pascal': 'What makes this universally relatable?',
      'netflix-exec': 'Where might viewers lose interest and click away?'
    };
    
    return questions[mentor.id] || 'How can this scene be more effective?';
  }
  
  private getSecondaryStructuralNote(scene: ScriptScene, mentor: Mentor): string {
    const notes = {
      'tony-gilroy': 'Ensure every element serves the story engine',
      'sofia-coppola': 'Trust atmospheric details to carry meaning',
      'vince-gilligan': 'Ground structure in character psychology',
      'amy-pascal': 'Keep structure accessible to broad audiences',
      'netflix-exec': 'Optimize structure for engagement and momentum'
    };
    
    return notes[mentor.id] || 'Consider alternative structural approaches';
  }
  
  private getDialogueAdviceForMentor(scene: ScriptScene, mentor: Mentor): string {
    const advice = {
      'tony-gilroy': 'Cut dialogue that doesn\'t advance plot or character',
      'sofia-coppola': 'Trust silences and subtext over exposition',
      'vince-gilligan': 'Ensure dialogue reveals character psychology',
      'amy-pascal': 'Make dialogue accessible yet sophisticated',
      'netflix-exec': 'Optimize dialogue for modern attention spans'
    };
    
    return advice[mentor.id] || 'Enhance dialogue effectiveness';
  }
  
  private getPacingInsightForMentor(scene: ScriptScene, mentor: Mentor): string {
    const insights = {
      'tony-gilroy': 'Cut ruthlessly - every beat must earn its place',
      'sofia-coppola': 'Allow natural rhythms and breathing room',
      'vince-gilligan': 'Pace according to character emotional states',
      'amy-pascal': 'Balance sophisticated pacing with accessibility',
      'netflix-exec': 'Maintain momentum for modern viewing habits'
    };
    
    return insights[mentor.id] || 'Consider pacing effectiveness';
  }
  
  private getBlendedMantra(mentors: Mentor[], weights: MentorWeights): string {
    const dominantMentor = mentors.reduce((prev, current) => 
      (weights[current.id] || 0) > (weights[prev.id] || 0) ? current : prev
    );
    
    const mantras = {
      'tony-gilroy': 'Every element must serve the story - cut what doesn\'t',
      'sofia-coppola': 'Trust the silence, trust the gesture, trust the truth',
      'vince-gilligan': 'Character psychology drives everything - stay true to that',
      'amy-pascal': 'Great stories make people care - never forget the human element',
      'netflix-exec': 'Every moment competes for attention - make it impossible to skip'
    };
    
    return mantras[dominantMentor.id] || 'Serve the story above all else';
  }
  
  private getDominantMentorInstinct(mentors: Mentor[], weights: MentorWeights, scene: ScriptScene): string {
    const dominantMentor = mentors.reduce((prev, current) => 
      (weights[current.id] || 0) > (weights[prev.id] || 0) ? current : prev
    );
    
    return `${dominantMentor.name} says: ${this.getMentorObservation(dominantMentor, scene)}`;
  }
  
  private getSecondaryMentorInstinct(mentors: Mentor[], weights: MentorWeights, scene: ScriptScene): string {
    const secondaryMentors = mentors.filter(m => m.id !== mentors.reduce((prev, current) => 
      (weights[current.id] || 0) > (weights[prev.id] || 0) ? current : prev
    ).id);
    
    if (secondaryMentors.length === 0) return 'No secondary perspective';
    
    const secondaryMentor = secondaryMentors.reduce((prev, current) => 
      (weights[current.id] || 0) > (weights[prev.id] || 0) ? current : prev
    );
    
    return `${secondaryMentor.name} adds: ${this.getMentorObservation(secondaryMentor, scene)}`;
  }
  
  private getCollectiveHunch(mentors: Mentor[], weights: MentorWeights, scene: ScriptScene): string {
    const sceneLength = scene.content.length;
    const hunches = [
      sceneLength > 400 ? 'This scene might be trying to do too much' : 'This scene needs more specificity',
      'The emotional stakes could be clearer',
      'Character objectives need sharpening',
      'The pacing feels off in places',
      'There\'s untapped potential here'
    ];
    
    return hunches[Math.floor(Math.random() * hunches.length)];
  }
  
  /**
   * Generate enhanced dual mock feedback as comprehensive fallback
   */
  private generateEnhancedDualMockFeedback(scene: ScriptScene, mentor: Mentor): Feedback {
    console.log('🎭 Generating enhanced mock feedback with comprehensive script analysis...');
    
    const structuredContent = this.generateEnhancedStructured(scene, mentor);
    const scratchpadContent = this.generateEnhancedScratchpad(scene, mentor);
    const categories = this.extractCategoriesFromText(structuredContent);
    
    return {
      id: `enhanced-dual-mock-${Date.now()}`,
      mentorId: mentor.id,
      sceneId: scene.id,
      structuredContent,
      scratchpadContent,
      timestamp: new Date(),
      categories,
      content: structuredContent // Legacy content field
    };
  }
  
  /**
   * Generate enhanced structured content with comprehensive script analysis
   */
  private generateEnhancedStructured(scene: ScriptScene, mentor: Mentor): string {
    const sceneContent = scene.content;
    const lines = sceneContent.split('\n');
    
    // Comprehensive script analysis
    const hasSceneHeading = sceneContent.match(/^(INT\.|EXT\.)/m);
    const dialogueLines = lines.filter(line => 
      line.trim() && line === line.toUpperCase() && !line.includes('.') && line.length < 40
    );
    const actionLines = lines.filter(line => 
      line.trim() && line !== line.toUpperCase() && !line.includes('(')
    );
    const hasParentheticals = sceneContent.includes('(') && sceneContent.includes(')');
    const characterCount = new Set(dialogueLines).size;
    
    let content = `## ${mentor.name} Analysis\n\n`;
    
    // Structure section with detailed analysis
    content += "### Structure\n\n";
    if (!hasSceneHeading) {
      content += "• **Missing Scene Heading**: Lines 1-3 lack proper INT./EXT. formatting - readers need immediate orientation\n";
      content += "• **Formatting Impact**: Without clear location establishment, the scene feels ungrounded\n";
    } else {
      const headingLine = lines.findIndex(line => line.match(/^(INT\.|EXT\.)/));
      content += `• **Scene Heading**: Line ${headingLine + 1} properly establishes location and context\n`;
    }
    
    if (sceneContent.length > 400) {
      content += `• **Scene Length**: ${sceneContent.length} characters suggests this scene may be handling multiple story beats\n`;
      content += "• **Focus**: Consider if this could be split into smaller, more focused dramatic moments\n";
    } else {
      content += "• **Scene Length**: Appropriately focused for its dramatic purpose\n";
    }
    
    // Enhanced dialogue analysis
    content += "\n### Dialogue\n\n";
    if (dialogueLines.length === 0) {
      content += "• **No Dialogue Present**: This is purely visual storytelling - consider if character voice would enhance the moment\n";
      content += "• **Character Perspective**: Missing opportunities to reveal character through speech patterns and word choice\n";
    } else {
      content += `• **Character Count**: ${characterCount} unique speakers identified in this scene\n`;
      
      const shortLines = dialogueLines.filter(line => line.trim().split(' ').length < 10);
      const longLines = dialogueLines.filter(line => line.trim().split(' ').length > 20);
      
      if (shortLines.length > longLines.length) {
        content += "• **Dialogue Style**: Tends toward brevity - ensure each short exchange carries weight\n";
      } else if (longLines.length > shortLines.length) {
        content += "• **Dialogue Style**: Leans toward longer speeches - check for naturalistic flow when spoken aloud\n";
      }
      
      if (!hasParentheticals) {
        content += "• **Character Direction**: No parentheticals present - consider where actor guidance might enhance clarity\n";
      }
    }
    
    // Enhanced pacing analysis
    content += "\n### Pacing\n\n";
    const actionToDialogueRatio = actionLines.length / (dialogueLines.length || 1);
    
    if (actionToDialogueRatio > 3) {
      content += "• **Action Heavy**: High ratio of description to dialogue - ensure visual details drive story forward\n";
    } else if (actionToDialogueRatio < 0.5) {
      content += "• **Dialogue Heavy**: More talk than action - consider balancing with visual storytelling moments\n";
    } else {
      content += "• **Balance**: Good ratio of action to dialogue for scene type\n";
    }
    
    const emptyLines = lines.filter(line => line.trim() === '').length;
    if (emptyLines > lines.length * 0.3) {
      content += "• **Pacing Control**: Good use of white space to create rhythm and breathing room\n";
    } else {
      content += "• **Density**: Consider adding strategic paragraph breaks to enhance flow\n";
    }
    
    // Theme section
    content += "\n### Theme\n\n";
    content += "• **Thematic Integration**: Ensure this scene connects to your larger story themes\n";
    content += "• **Subtext Opportunities**: Look for ways to layer deeper meaning through character choices\n";
    
    // Enhanced mentor-specific actionable advice
    content += "\n### Actionable Advice\n\n";
    const advice = this.generateEnhancedMentorSpecificAdvice(mentor, scene, {
      hasSceneHeading: !!hasSceneHeading,
      dialogueCount: dialogueLines.length,
      actionCount: actionLines.length,
      sceneLength: sceneContent.length,
      characterCount,
      hasParentheticals
    });
    
    advice.forEach(item => {
      content += `• ${item}\n`;
    });
    
    content += `\n"${mentor.mantra || 'Every word must earn its place on the page.'}"`;
    
    return content;
  }
  
  /**
   * Generate enhanced scratchpad content with detailed script reactions
   */
  private generateEnhancedScratchpad(scene: ScriptScene, mentor: Mentor): string {
    const mentorName = mentor.name.toUpperCase();
    const sceneContent = scene.content;
    const lines = sceneContent.split('\n');
    
    let notes = `## ${mentorName} Scratchpad\n\n`;
    
    // Enhanced initial observations with line references
    const observations: string[] = [];
    
    const firstLine = lines.find(line => line.trim())?.trim() || '';
    if (firstLine.match(/^(INT\.|EXT\.)/)) {
      observations.push(`Opening establishes location immediately - good foundation`);
    } else if (firstLine) {
      observations.push(`Opens with "${firstLine.substring(0, 30)}${firstLine.length > 30 ? '...' : ''}" - is this the strongest possible hook?`);
    }
    
    const dialogueLines = lines.filter(line => 
      line.trim() && line === line.toUpperCase() && !line.includes('.') && line.length < 40
    );
    
    if (dialogueLines.length > 0) {
      const firstSpeaker = dialogueLines[0];
      observations.push(`First voice we hear is ${firstSpeaker} - does this character drive the scene?`);
      
      if (dialogueLines.length > 5) {
        observations.push(`Heavy dialogue scene (${dialogueLines.length} exchanges) - are we talking when we could be showing?`);
      }
    }
    
    if (sceneContent.length > 500) {
      observations.push(`Scene runs long (${sceneContent.length} chars) - what's the one essential thing that has to happen here?`);
    }
    
    if (observations.length > 0) {
      notes += "### Initial Observations\n\n";
      observations.forEach(obs => {
        notes += `• ${obs}\n`;
      });
      notes += "\n";
    }
    
    // Enhanced questions with script context
    const questions = this.generateEnhancedMentorQuestions(mentor, scene, {
      hasDialogue: dialogueLines.length > 0,
      sceneLength: sceneContent.length,
      characterCount: dialogueLines.length,
      hasSceneHeading: !!sceneContent.match(/^(INT\.|EXT\.)/m)
    });
    
    if (questions.length > 0) {
      notes += "### Questions to Explore\n\n";
      questions.forEach(q => {
        notes += `• ${q}\n`;
      });
    }
    
    notes += `\n"${mentor.mantra || 'Every word must earn its place on the page.'}"`;
    
    return notes;
  }
  
  /**
   * Generate enhanced mentor-specific actionable advice
   */
  private generateEnhancedMentorSpecificAdvice(mentor: Mentor, scene: ScriptScene, analysis: any): string[] {
    const advice: string[] = [];
    
    switch (mentor.id) {
      case 'tony-gilroy':
        advice.push("**Test Scene Necessity**: Ask 'What breaks if we cut this scene?' - if nothing essential is lost, strengthen or eliminate");
        advice.push("**Character Objectives**: Give each character a specific, achievable goal they pursue actively throughout the scene");
        if (analysis.sceneLength > 400) {
          advice.push("**Ruthless Editing**: Cut anything that doesn't advance character development or plot progression");
        }
        advice.push("**Conflict Clarity**: Identify what each character wants and what specific obstacle prevents them from getting it");
        if (!analysis.hasSceneHeading) {
          advice.push("**Professional Formatting**: Add proper scene heading for industry-standard presentation");
        }
        break;
        
      case 'sofia-coppola':
        advice.push("**Emotional Authenticity**: Focus on what characters feel rather than what they say about their feelings");
        advice.push("**Atmospheric Details**: Add sensory elements that reflect the characters' internal states");
        if (analysis.dialogueCount > 5) {
          advice.push("**Trust Silence**: Look for moments where a pause or gesture could replace dialogue");
        }
        advice.push("**Behavioral Truth**: Show character psychology through small actions and choices rather than exposition");
        if (!analysis.hasParentheticals) {
          advice.push("**Subtext Enhancement**: Consider strategic parentheticals to guide emotional subtleties");
        }
        break;
        
      case 'vince-gilligan':
        advice.push("**Character Psychology**: Ensure every choice feels both inevitable and surprising based on established character traits");
        advice.push("**Moral Complexity**: Give characters difficult decisions with no clearly right answer");
        advice.push("**Consequence Setup**: Plant elements that will create future complications based on character flaws");
        advice.push("**Psychological Truth**: Test each decision against what this specific person would actually do");
        if (analysis.characterCount > 1) {
          advice.push("**Character Conflict**: Ensure each character's psychology creates natural conflict with others");
        }
        break;
        
      case 'amy-pascal':
        advice.push("**Universal Connection**: Find the relatable human emotion at the core of this specific situation");
        advice.push("**Character Likability**: Balance character flaws with sympathetic qualities that make audiences care");
        advice.push("**Clear Stakes**: Make sure readers understand exactly what the character risks losing");
        advice.push("**Accessibility**: Ensure sophisticated concepts are communicated in emotionally clear terms");
        if (analysis.sceneLength > 300) {
          advice.push("**Audience Engagement**: Break complex scenes into digestible emotional beats");
        }
        break;
        
      case 'netflix-exec':
        advice.push("**Forward Momentum**: End with a hook that makes skipping the next scene impossible");
        advice.push("**Genre Clarity**: Deliver on the specific expectations this genre creates for audiences");
        if (analysis.sceneLength > 300) {
          advice.push("**Pacing Optimization**: Tighten for modern attention spans - every beat must earn its screen time");
        }
        advice.push("**Engagement Testing**: Identify potential 'scroll past' moments and convert them to 'lean in' beats");
        if (analysis.dialogueCount > 6) {
          advice.push("**Dialogue Efficiency**: Streamline conversations for modern viewing patterns");
        }
        break;
        
      default:
        advice.push("**Clarify Objectives**: Make each character's scene goal crystal clear and active");
        advice.push("**Visual Storytelling**: Include specific details that help readers see and feel the scene");
        advice.push("**Subtext Development**: Find opportunities for characters to communicate indirectly");
    }
    
    return advice;
  }
  
  /**
   * Generate enhanced mentor-specific questions with comprehensive script awareness
   */
  private generateEnhancedMentorQuestions(mentor: Mentor, scene: ScriptScene, analysis: any): string[] {
    const questions: string[] = [];
    
    switch (mentor.id) {
      case 'tony-gilroy':
        questions.push("What's the engine driving this scene forward - what has to happen here?");
        if (analysis.sceneLength > 400) {
          questions.push("Could we start this scene 30 seconds later and lose nothing essential?");
        }
        questions.push("Who has the most to lose in this moment, and are they actively fighting for it?");
        if (analysis.hasDialogue) {
          questions.push("What's the real conflict hiding underneath the surface conversation?");
        }
        if (!analysis.hasSceneHeading) {
          questions.push("How does unclear location affect the scene's dramatic impact?");
        }
        break;
        
      case 'sofia-coppola':
        questions.push("What's the emotional temperature of this moment - hot, cold, or building?");
        questions.push("What are the characters feeling but deliberately not expressing?");
        if (analysis.characterCount > 1) {
          questions.push("How would this scene play if the characters never spoke to each other?");
        }
        questions.push("What does the environment tell us about the characters' inner lives?");
        if (analysis.sceneLength > 300) {
          questions.push("Where can we trust silence to do the work instead of words?");
        }
        break;
        
      case 'vince-gilligan':
        questions.push("What character flaw drives the conflict in this specific moment?");
        questions.push("Why does this character make THIS choice rather than the obvious alternative?");
        questions.push("How do the consequences of this scene create the next story problem?");
        questions.push("What moral complexity makes this situation impossible to judge simply?");
        if (analysis.characterCount > 2) {
          questions.push("How does each character's psychology create inevitable conflict?");
        }
        break;
        
      case 'amy-pascal':
        questions.push("What makes this situation relatable to anyone who's never been in it?");
        questions.push("How does this scene make us care more about these characters?");
        questions.push("What universal fear or desire drives this specific conflict?");
        questions.push("How does this serve both the story and broad audience engagement?");
        if (analysis.sceneLength > 400) {
          questions.push("How can we make complex emotions immediately accessible?");
        }
        break;
        
      case 'netflix-exec':
        questions.push("What specific element makes viewers unable to stop watching?");
        questions.push("Does this scene pull toward the next one or feel self-contained?");
        if (analysis.sceneLength > 300) {
          questions.push("Where might modern viewers lose interest and click away?");
        }
        questions.push("How clearly does this deliver on the genre promise we've made?");
        if (analysis.dialogueCount > 5) {
          questions.push("Could this conversation be 30% shorter without losing impact?");
        }
        break;
        
      default:
        questions.push("What does each character want that they're not getting in this scene?");
        questions.push("Where's the hidden tension beneath the surface action?");
        questions.push("How can we make this scene impossible to cut from the story?");
    }
    
    return questions.slice(0, 4); // Limit to 4 questions for readability
  }
  
  /**
   * Extract categories from formatted structured content with enhanced parsing
   */
  private extractCategoriesFromText(content: string): { structure: string; dialogue: string; pacing: string; theme: string } {
    const categories = {
      structure: '',
      dialogue: '',
      pacing: '',
      theme: ''
    };
    
    const sections = content.split('###').filter(section => section.trim());
    
    sections.forEach(section => {
      const lines = section.split('\n').filter(line => line.trim());
      if (lines.length === 0) return;
      
      const header = lines[0].trim().toLowerCase();
      const sectionContent = lines.slice(1)
        .filter(line => line.trim())
        .map(line => line.replace(/^[•\-*]\s*/, '').replace(/^\*\*[^*]+\*\*:\s*/, ''))
        .join(' ')
        .trim();
      
      if (header.includes('structure')) {
        categories.structure = sectionContent;
      } else if (header.includes('dialogue')) {
        categories.dialogue = sectionContent;
      } else if (header.includes('pacing')) {
        categories.pacing = sectionContent;
      } else if (header.includes('theme')) {
        categories.theme = sectionContent;
      }
    });
    
    return categories;
  }
}