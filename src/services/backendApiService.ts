import { Feedback } from '../types';

interface BackendFeedbackRequest {
  scene_content: string;
  mentor_id: string;
  character_context?: string;
  feedback_mode: 'structured' | 'scratchpad';
  system_prompt: string;
  temperature: number;
}

interface BackendFeedbackResponse {
  success: boolean;
  feedback: string;
  mentor_id: string;
  feedback_mode: string;
  timestamp: string;
  error?: string;
}

class BackendApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'https://smbackend-production.up.railway.app/api';
  }

  async generateFeedback(request: BackendFeedbackRequest): Promise<string> {
    try {
      const enhancedRequest = {
        ...request,
        formatting_instructions: this.getFormattingInstructions(request.feedback_mode)
      };

      console.log('🚀 Sending enhanced feedback request:', {
        mentor_id: request.mentor_id,
        mode: request.feedback_mode,
        scene_length: request.scene_content.length
      });

      const response = await fetch(`${this.baseUrl}/generate-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enhancedRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Backend API Error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const data: BackendFeedbackResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Feedback generation failed');
      }

      console.log('✅ Received formatted feedback from backend');
      return data.feedback;

    } catch (error) {
      console.error('❌ Backend API call failed:', error);
      throw error;
    }
  }

  private getFormattingInstructions(mode: 'structured' | 'scratchpad'): string {
    if (mode === 'scratchpad') {
      return `
FORMATTING INSTRUCTIONS FOR SCRATCHPAD MODE:
- Use clean section headers with ## (e.g., "## Initial Thoughts")
- Group related thoughts under clear subsections
- Use bullet points (•) instead of numbered lists
- Keep thoughts conversational and unfiltered
- Focus on questions, hunches, and creative possibilities
- Maximum 6-8 bullet points total
- Each point should be a complete thought
- End with a provocative mantra or challenge

EXAMPLE FORMAT:
## Initial Observations
• First key observation about the scene
• Second insight or concern

## Questions to Explore  
• What if we tried this approach?
• Where's the hidden conflict here?

## Mantra
"Cut what you don't need. Then cut again."
      `.trim();
    } else {
      return `
FORMATTING INSTRUCTIONS FOR STRUCTURED MODE:
- Use clear section headers with ### (e.g., "### Structure")
- Always include these sections: Structure, Dialogue, Pacing, Theme, Actionable Advice
- Use bullet points (•) instead of numbered lists
- Each section should have 2-3 specific, actionable points
- Be constructive and specific in feedback
- End with concrete, implementable advice
- End with a mentor-specific mantra that encapsulates the feedback

EXAMPLE FORMAT:
### Structure
• Specific observation about scene structure
• Suggestion for structural improvement

### Dialogue  
• Assessment of dialogue effectiveness
• Recommendation for dialogue enhancement

### Pacing
• Analysis of scene rhythm and flow
• Suggestion for pacing adjustment

### Theme
• Thematic strength or weakness identified
• Way to deepen thematic resonance

### Actionable Advice
• **Specific Action**: Concrete step to improve the scene
• **Another Action**: Second implementable recommendation

### Mantra
"Write the feeling, not the explanation."
      `.trim();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const isHealthy = response.ok;
      
      if (isHealthy) {
        const data = await response.json();
        console.log('💚 Backend health check passed:', data);
      }
      
      return isHealthy;
    } catch (error) {
      console.warn('🔴 Backend health check failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log('🔍 Testing backend connection...');
      
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
        message: 'Connection successful',
        data
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async testFeedbackGeneration(): Promise<{ success: boolean; message: string; feedback?: string }> {
    try {
      console.log('🧪 Testing feedback generation...');
      
      const testRequest: BackendFeedbackRequest = {
        scene_content: `INT. COFFEE SHOP - MORNING
        
Alex sits at a corner table, staring at a blank laptop screen. The cursor blinks mockingly.

ALEX
(to himself)
Come on... just write something.`,
        mentor_id: 'tony-gilroy',
        feedback_mode: 'structured',
        system_prompt: 'You are a screenplay mentor providing feedback.',
        temperature: 0.7,
        character_context: 'Alex: Struggling screenwriter with writer\'s block'
      };

      const feedback = await this.generateFeedback(testRequest);
      
      return {
        success: true,
        message: 'Feedback generation test successful',
        feedback
      };
    } catch (error) {
      return {
        success: false,
        message: `Feedback test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const backendApiService = new BackendApiService();