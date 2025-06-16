// src/services/aiFeedbackService.ts
import { Mentor, ScriptScene, Feedback, ScriptRewrite, Character } from '../types';
import { backendApiService } from './backendApiService';
import { getMentorFeedbackStyle } from '../data/mentors';
import { CharacterDataNormalizer } from '../utils/characterDataNormalizer';

interface AIFeedbackRequest {
  scene: ScriptScene;
  mentor: Mentor;
  characters: Record<string, Character>;
}

interface AIFeedbackResponse {
  feedback: Feedback;
  rewrite?: ScriptRewrite;
}

class AIFeedbackService {
  constructor() {
    this.checkBackendHealth();
  }
  
  private async checkBackendHealth(): Promise<void> {
    try {
      const isHealthy = await backendApiService.healthCheck();
      console.log(`🔗 Backend connection: ${isHealthy ? 'Connected ✅' : 'Disconnected ❌'}`);
    } catch (error) {
      console.warn('Backend health check failed:', error);
    }
  }
  
  async generateDualFeedback(request: AIFeedbackRequest): Promise<AIFeedbackResponse> {
    console.log('🤖 AI Service generating dual feedback for:', {
      mentor: request.mentor.name,
      sceneLength: request.scene.content.length,
      characterCount: Object.keys(request.characters).length
    });
    
    try {
      // Get mentor-specific feedback style
      const feedbackStyle = getMentorFeedbackStyle(request.mentor);
      
      // Build character context with proper error handling
      const characterContext = this.buildCharacterContext(request.characters);
      
      // Generate both types of feedback in parallel with mentor-specific settings
      const [structuredContent, scratchpadContent] = await Promise.all([
        this.generateSingleFeedback(request, 'structured', characterContext, feedbackStyle),
        this.generateSingleFeedback(request, 'scratchpad', characterContext, feedbackStyle)
      ]);
      
      // Create the dual feedback object
      const feedback = this.createDualFeedbackObject(
        structuredContent, 
        scratchpadContent, 
        request
      );
      
      console.log('✅ Successfully generated both structured and scratchpad feedback');
      return { feedback };
      
    } catch (error) {
      console.warn('AI dual feedback failed, using enhanced mock:', error);
      return { feedback: this.generateEnhancedDualFeedback(request) };
    }
  }
  
  private async generateSingleFeedback(
    request: AIFeedbackRequest, 
    mode: 'structured' | 'scratchpad',
    characterContext: string,
    feedbackStyle: { systemPrompt: string; temperature: number }
  ): Promise<string> {
    try {
      const feedbackContent = await backendApiService.generateFeedback({
        scene_content: request.scene.content,
        mentor_id: request.mentor.id,
        character_context: characterContext,
        feedback_mode: mode,
        system_prompt: feedbackStyle.systemPrompt,
        temperature: feedbackStyle.temperature
      });
      
      return this.cleanFeedbackContent(feedbackContent, mode, request.mentor);
    } catch (error) {
      console.warn(`Failed to generate ${mode} feedback, using mock:`, error);
      return this.generateMockFeedback(request, mode);
    }
  }
  
  private cleanFeedbackContent(content: string, mode: 'structured' | 'scratchpad', mentor: Mentor): string {
    // Add mentor's mantra at the end of the feedback
    const cleanedContent = content.trim();
    return `${cleanedContent}\n\n"${mentor.mantra}"`;
  }
  
  /**
   * Build character context with proper error handling and type checking
   */
  private buildCharacterContext(characters: Record<string, Character>): string {
    try {
      // Debug the incoming character data
      CharacterDataNormalizer.debugCharacterData(characters, 'aiFeedbackService.buildCharacterContext');
      
      // Use the normalizer to create safe character context
      const result = CharacterDataNormalizer.createCharacterContext(characters);
      
      console.log('📝 Built character context:', result || 'No character context available');
      return result;
      
    } catch (error) {
      console.error('❌ Error building character context:', error);
      console.log('Characters object:', characters);
      
      // Ultimate fallback: create basic context from character names
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
  
  private extractCategoriesFromText(text: string): { structure: string; dialogue: string; pacing: string; theme: string } {
    const categories = {
      structure: '',
      dialogue: '',
      pacing: '',
      theme: ''
    };
    
    // Split text into sections based on headers
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
  
  private cleanCategoryContent(content: string): string {
    return content
      .replace(/^### /gm, '') // Remove section headers
      .replace(/^\d+\.\s*/gm, '- ') // Convert numbered lists to bullet points
      .trim();
  }
  
  private generateMockFeedback(request: AIFeedbackRequest, mode: 'structured' | 'scratchpad'): string {
    if (mode === 'scratchpad') {
      return this.generateEnhancedScratchpad(request);
    } else {
      return this.generateEnhancedStructured(request);
    }
  }
  
  private generateEnhancedDualFeedback(request: AIFeedbackRequest): Feedback {
    const structuredContent = this.generateEnhancedStructured(request);
    const scratchpadContent = this.generateEnhancedScratchpad(request);
    
    return this.createDualFeedbackObject(structuredContent, scratchpadContent, request);
  }
  
  private generateEnhancedScratchpad(request: AIFeedbackRequest): string {
    const mentorName = request.mentor.name.toUpperCase();
    const scene = request.scene.content;
    
    // Analyze the actual scene content
    const hasSceneHeading = scene.includes('INT.') || scene.includes('EXT.');
    const hasDialogue = scene.split('\n').some(line => line.trim() && !line.includes('.') && line === line.toUpperCase());
    const wordCount = scene.split(' ').length;
    
    let notes = `## ${mentorName} Scratchpad\n\n`;
    
    const observations: string[] = [];
    const questions: string[] = [];
    
    // Scene-specific analysis
    if (!hasSceneHeading) {
      observations.push("Missing scene heading creates immediate disorientation for the reader");
    }
    
    if (wordCount > 200) {
      observations.push("Scene length suggests we might be trying to accomplish too much in one beat");
    }
    
    if (!hasDialogue) {
      observations.push("All action, no voice - are we missing character personality?");
    }
    
    // Mentor-specific questions
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
    
    return notes;
  }
  
  private generateEnhancedStructured(request: AIFeedbackRequest): string {
    const scene = request.scene.content;
    const mentor = request.mentor.name;
    
    let feedback = `## ${mentor} Analysis\n\n`;
    
    // Structure analysis
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
    
    return feedback;
  }
  
  async generateFeedback(request: AIFeedbackRequest & { mode?: 'structured' | 'scratchpad' }): Promise<AIFeedbackResponse> {
    // If legacy mode is specified, just return that content in the appropriate field
    if (request.mode) {
      const feedbackStyle = getMentorFeedbackStyle(request.mentor);
      const characterContext = this.buildCharacterContext(request.characters);
      const singleContent = await this.generateSingleFeedback(request, request.mode, characterContext, feedbackStyle);
      const dualFeedback = request.mode === 'structured' 
        ? this.createDualFeedbackObject(singleContent, '', request)
        : this.createDualFeedbackObject('', singleContent, request);
      
      return { feedback: dualFeedback };
    }
    
    // Default: generate both
    return this.generateDualFeedback(request);
  }
}

export const aiFeedbackService = new AIFeedbackService();