// src/services/enhancedMentorFeedbackService.ts
import { Mentor, ScriptScene, Feedback, Character } from '../types';
import { CharacterDataNormalizer } from '../utils/characterDataNormalizer';

interface ScriptAnalysis {
  structure: {
    sceneType: string;
    pacing: string;
    conflicts: string[];
    hooks: string[];
    sceneLength: string;
    formatIssues: string[];
  };
  dialogue: {
    characterVoices: Record<string, string>;
    subtext: string;
    naturalness: string;
    purposes: string[];
    specificIssues: string[];
  };
  characterization: {
    objectives: Record<string, string>;
    obstacles: Record<string, string>;
    arcs: Record<string, string>;
    consistency: string[];
  };
  technicalCraft: {
    formatting: string;
    clarity: string;
    efficiency: string;
    visualStorytelling: string;
  };
  specificIssues: string[];
  strengths: string[];
  lineReferences: string[];
}

export class EnhancedMentorFeedbackService {
  private baseUrl = 'https://smbackend-production.up.railway.app/api';

  /**
   * Generate enhanced mentor feedback using multi-stage GPT-4o analysis
   */
  async generateEnhancedFeedback(
    scene: ScriptScene,
    mentor: Mentor,
    characters: Record<string, Character>
  ): Promise<Feedback> {
    console.log('🧠 Enhanced Mentor Analysis Starting...', {
      mentor: mentor.name,
      sceneLength: scene.content.length,
      characterCount: Object.keys(characters).length
    });

    try {
      // Normalize character data to prevent type errors
      const normalizedCharacters = CharacterDataNormalizer.normalizeCharacters(characters);
      console.log('🔧 Normalized characters for enhanced feedback:', normalizedCharacters);
      
      // Stage 1: Deep Script Analysis
      const scriptAnalysis = await this.analyzeScript(scene, normalizedCharacters);
      console.log('📊 Script Analysis Complete:', {
        issuesFound: scriptAnalysis.specificIssues.length,
        strengthsFound: scriptAnalysis.strengths.length,
        lineReferences: scriptAnalysis.lineReferences.length
      });
      
      // Stage 2: Generate Mentor-Specific Feedback
      const [structuredFeedback, scratchpadFeedback] = await Promise.all([
        this.generateMentorSpecificFeedback(scene, mentor, scriptAnalysis, 'structured'),
        this.generateMentorSpecificFeedback(scene, mentor, scriptAnalysis, 'scratchpad')
      ]);

      console.log('✅ Enhanced Feedback Generation Complete');

      // Stage 3: Create Enhanced Feedback Object
      return this.createEnhancedFeedbackObject(
        structuredFeedback, 
        scratchpadFeedback, 
        scene, 
        mentor, 
        scriptAnalysis
      );

    } catch (error) {
      console.error('Enhanced feedback generation failed:', error);
      // Fallback to enhanced mock feedback with normalized characters
      const normalizedCharacters = CharacterDataNormalizer.normalizeCharacters(characters);
      return this.generateEnhancedMockFeedback(scene, mentor, normalizedCharacters);
    }
  }

  /**
   * Stage 1: Deep Script Analysis using GPT-4o
   */
  private async analyzeScript(
    scene: ScriptScene, 
    characters: Record<string, Character>
  ): Promise<ScriptAnalysis> {
    const analysisPrompt = `You are a master screenplay analyst with decades of industry experience. Perform a surgical analysis of this script excerpt.

SCRIPT TO ANALYZE:
"""
${scene.content}
"""

CHARACTER CONTEXT:
${CharacterDataNormalizer.createCharacterContext(characters) || 'No character context provided'}

Analyze this script with surgical precision. For each category, provide specific examples and line references:

1. STRUCTURAL ANALYSIS:
   - Scene type (setup, confrontation, resolution, transition, exposition)
   - Pacing assessment (rushed, dragging, well-balanced)
   - Conflict sources and escalation patterns
   - Story hooks and momentum builders
   - Scene length appropriateness
   - Formatting strengths/weaknesses

2. DIALOGUE EVALUATION:
   - Character voice distinctiveness (give examples)
   - Subtext depth and effectiveness
   - Natural speech patterns vs. exposition
   - Multiple purposes served by exchanges
   - Specific dialogue problems (with line references)

3. CHARACTER WORK:
   - Clear objectives for each character in this scene
   - Obstacles preventing characters from achieving goals  
   - Character revelation and development moments
   - Consistency with established character traits

4. TECHNICAL CRAFT:
   - Scene heading clarity and formatting
   - Action line efficiency and visual quality
   - Overall scene construction effectiveness
   - Visual storytelling strength

5. SPECIFIC ISSUES:
   - Identify 3-5 concrete problems with exact line references
   - Note any clichés, redundancies, or unclear moments
   - Flag dialogue that doesn't sound natural when spoken

6. GENUINE STRENGTHS:
   - What specifically works well in this script?
   - Which moments feel authentic and engaging?
   - What techniques show writing skill?

7. LINE REFERENCES:
   - Create specific references to lines, characters, and moments
   - Use format: "Line X where [character] says [quote]"

Return analysis in valid JSON format with specific examples and concrete observations.`;

    try {
      const response = await this.callGPT4o(analysisPrompt, 0.3, true);
      const analysis = JSON.parse(response);
      
      // Validate and structure the analysis
      return this.validateAndStructureAnalysis(analysis, scene);
    } catch (error) {
      console.error('Script analysis failed:', error);
      return this.generateFallbackAnalysis(scene, characters);
    }
  }

  /**
   * Stage 2: Generate Mentor-Specific Feedback
   */
  private async generateMentorSpecificFeedback(
    scene: ScriptScene,
    mentor: Mentor,
    analysis: ScriptAnalysis,
    mode: 'structured' | 'scratchpad'
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/generate-enhanced-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_content: scene.content,
          mentor_id: mentor.id,
          character_context: this.buildCharacterContext(analysis),
          feedback_mode: mode,
          analysis_data: analysis
        })
      });

      if (!response.ok) {
        throw new Error(`Enhanced feedback API failed: ${response.status}`);
      }

      const data = await response.json();
      return data.feedback || '';
    } catch (error) {
      console.error(`${mode} feedback generation failed:`, error);
      return this.generateFallbackFeedback(scene, mentor, mode, analysis);
    }
  }

  /**
   * Call GPT-4o with proper error handling
   */
  private async callGPT4o(
    prompt: string, 
    temperature: number, 
    jsonMode: boolean = false
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/openai-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: prompt }
        ],
        model: 'gpt-4o',
        temperature,
        max_tokens: 4000,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`GPT-4o API failed: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    return data.content || '';
  }

  /**
   * Validate and structure analysis data
   */
  private validateAndStructureAnalysis(analysis: any, scene: ScriptScene): ScriptAnalysis {
    return {
      structure: {
        sceneType: analysis.structure?.sceneType || 'Unknown',
        pacing: analysis.structure?.pacing || 'Needs analysis',
        conflicts: Array.isArray(analysis.structure?.conflicts) ? analysis.structure.conflicts : [],
        hooks: Array.isArray(analysis.structure?.hooks) ? analysis.structure.hooks : [],
        sceneLength: analysis.structure?.sceneLength || 'Appropriate',
        formatIssues: Array.isArray(analysis.structure?.formatIssues) ? analysis.structure.formatIssues : []
      },
      dialogue: {
        characterVoices: analysis.dialogue?.characterVoices || {},
        subtext: analysis.dialogue?.subtext || 'Present',
        naturalness: analysis.dialogue?.naturalness || 'Natural',
        purposes: Array.isArray(analysis.dialogue?.purposes) ? analysis.dialogue.purposes : [],
        specificIssues: Array.isArray(analysis.dialogue?.specificIssues) ? analysis.dialogue.specificIssues : []
      },
      characterization: {
        objectives: analysis.characterization?.objectives || {},
        obstacles: analysis.characterization?.obstacles || {},
        arcs: analysis.characterization?.arcs || {},
        consistency: Array.isArray(analysis.characterization?.consistency) ? analysis.characterization.consistency : []
      },
      technicalCraft: {
        formatting: analysis.technicalCraft?.formatting || 'Standard',
        clarity: analysis.technicalCraft?.clarity || 'Clear',
        efficiency: analysis.technicalCraft?.efficiency || 'Efficient',
        visualStorytelling: analysis.technicalCraft?.visualStorytelling || 'Present'
      },
      specificIssues: Array.isArray(analysis.specificIssues) ? analysis.specificIssues : [],
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
      lineReferences: Array.isArray(analysis.lineReferences) ? analysis.lineReferences : []
    };
  }

  /**
   * Build character context for feedback generation with proper normalization
   */
  private buildCharacterContext(analysis: ScriptAnalysis): string {
    try {
      const contexts: string[] = [];
      
      Object.entries(analysis.characterization.objectives).forEach(([name, objective]) => {
        const obstacle = analysis.characterization.obstacles[name] || 'Unknown obstacle';
        contexts.push(`${name}: Wants ${objective}, but faces ${obstacle}`);
      });
      
      const result = contexts.join('\n') || 'No specific character analysis available';
      console.log('📝 Enhanced service character context:', result);
      return result;
    } catch (error) {
      console.error('❌ Error building enhanced character context:', error);
      return 'Character analysis unavailable due to processing error';
    }
  }

  /**
   * Create enhanced feedback object with analysis metadata
   */
  private createEnhancedFeedbackObject(
    structuredContent: string,
    scratchpadContent: string,
    scene: ScriptScene,
    mentor: Mentor,
    analysis: ScriptAnalysis
  ): Feedback {
    return {
      id: `enhanced-feedback-${Date.now()}`,
      mentorId: mentor.id,
      sceneId: scene.id,
      structuredContent,
      scratchpadContent,
      timestamp: new Date(),
      categories: {
        structure: analysis.structure.pacing || 'Analyzed',
        dialogue: analysis.dialogue.naturalness || 'Analyzed', 
        pacing: analysis.structure.sceneType || 'Analyzed',
        theme: analysis.specificIssues.slice(0, 2).join('; ') || 'Analyzed'
      },
      content: structuredContent // Legacy field
    };
  }

  /**
   * Fallback analysis if GPT-4o fails - safely handles character data
   */
  private generateFallbackAnalysis(scene: ScriptScene, characters: Record<string, Character>): ScriptAnalysis {
    const lines = scene.content.split('\n');
    const hasDialogue = lines.some(line => line.trim() === line.trim().toUpperCase() && 
      line.trim().length > 0 && line.trim().length < 40);
    const hasSceneHeading = scene.content.includes('INT.') || scene.content.includes('EXT.');
    
    // Safely extract character names
    let characterNames: string[] = [];
    try {
      const normalizedCharacters = CharacterDataNormalizer.normalizeCharacters(characters);
      characterNames = Object.keys(normalizedCharacters);
    } catch (error) {
      console.warn('⚠️ Error processing characters in fallback analysis:', error);
      characterNames = [];
    }
    
    return {
      structure: {
        sceneType: scene.content.length > 300 ? 'Extended scene' : 'Brief scene',
        pacing: scene.content.length > 500 ? 'Potentially slow' : 'Efficient',
        conflicts: hasDialogue ? ['Character interaction present'] : ['Action-focused'],
        hooks: hasSceneHeading ? ['Proper scene heading'] : ['Missing scene heading'],
        sceneLength: scene.content.length > 400 ? 'Long' : 'Appropriate',
        formatIssues: hasSceneHeading ? [] : ['Missing scene heading']
      },
      dialogue: {
        characterVoices: {},
        subtext: hasDialogue ? 'Present' : 'None',
        naturalness: 'Requires analysis',
        purposes: ['Character development'],
        specificIssues: hasDialogue ? [] : ['No dialogue present']
      },
      characterization: {
        objectives: {},
        obstacles: {},
        arcs: {},
        consistency: characterNames.length > 0 ? [`${characterNames.length} characters identified`] : []
      },
      technicalCraft: {
        formatting: hasSceneHeading ? 'Good' : 'Needs work',
        clarity: 'Readable',
        efficiency: 'Functional',
        visualStorytelling: 'Present'
      },
      specificIssues: ['Requires detailed AI analysis for specific issues'],
      strengths: ['Script uploaded successfully'],
      lineReferences: ['Lines 1-10: Opening section']
    };
  }

  /**
   * Fallback feedback if GPT-4o fails
   */
  private generateFallbackFeedback(
    scene: ScriptScene, 
    mentor: Mentor, 
    mode: string,
    analysis?: ScriptAnalysis
  ): string {
    const mantra = mentor.mantra || "Every word must earn its place on the page.";
    
    if (mode === 'scratchpad') {
      return `## ${mentor.name} Scratchpad\n\n### Initial Observations\n• This scene needs deeper GPT-4o analysis for specific insights\n• Script structure appears functional based on basic analysis\n• Character work requires more detailed examination\n\n### Questions to Explore\n• What's the core conflict driving this moment?\n• How can we enhance character objectives?\n• Where are the specific line-level improvements needed?\n\n### Next Steps\n• Retry with full GPT-4o analysis\n• Focus on specific script content references\n\n"${mantra}"`;
    } else {
      return `## ${mentor.name} Analysis\n\n### Structure\n• Scene structure requires detailed GPT-4o examination for specific insights\n• ${analysis?.structure.sceneType || 'Scene type'} needs focused analysis\n\n### Dialogue\n• Character voices need specific line-by-line analysis\n• ${analysis?.dialogue.naturalness || 'Dialogue quality'} requires detailed review\n\n### Character Development\n• Character objectives should be clarified through enhanced analysis\n• Specific character moments need identification\n\n### ${mentor.name}'s Priority Focus\n• This script deserves the full enhanced analysis treatment\n• Retry for script-specific, line-referenced feedback\n\n### Actionable Advice\n• **Enhanced Analysis**: Use full GPT-4o system for detailed insights\n• **Script-Specific**: Get feedback that references actual lines and moments\n• **Mentor Voice**: Access authentic ${mentor.name} perspective\n\n"${mantra}"`;
    }
  }

  /**
   * Enhanced mock feedback with more specificity - uses normalized character data
   */
  private generateEnhancedMockFeedback(
    scene: ScriptScene, 
    mentor: Mentor, 
    characters: Record<string, Character>
  ): Feedback {
    // Ensure characters are normalized before processing
    const normalizedCharacters = CharacterDataNormalizer.normalizeCharacters(characters);
    const analysis = this.generateFallbackAnalysis(scene, normalizedCharacters);
    const structuredContent = this.generateFallbackFeedback(scene, mentor, 'structured', analysis);
    const scratchpadContent = this.generateFallbackFeedback(scene, mentor, 'scratchpad', analysis);
    
    return this.createEnhancedFeedbackObject(
      structuredContent, 
      scratchpadContent, 
      scene, 
      mentor, 
      analysis
    );
  }
}