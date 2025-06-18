// src/services/backendApiService.ts - Complete enhanced version with cancellation support
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
  private activeRequests: Map<string, AbortController> = new Map(); // NEW: Request tracking

  constructor() {
    this.baseUrl = 'https://smbackend-production.up.railway.app/api';
  }

  /**
   * Generate feedback with optional cancellation support
   * ENHANCED: Now supports AbortSignal while preserving all original functionality
   */
  async generateFeedback(
    request: BackendFeedbackRequest, 
    abortSignal?: AbortSignal // NEW: Optional abort signal
  ): Promise<string> {
    try {
      const enhancedRequest = {
        ...request,
        formatting_instructions: this.getFormattingInstructions(request.feedback_mode)
      };

      console.log('🚀 Sending enhanced feedback request:', {
        mentor_id: request.mentor_id,
        mode: request.feedback_mode,
        scene_length: request.scene_content.length,
        canCancel: !!abortSignal // NEW: Log cancellation capability
      });

      // NEW: Create abort controller if signal provided
      const controller = new AbortController();
      const requestId = `${request.mentor_id}-${Date.now()}`;
      
      // NEW: Store controller for potential cancellation
      if (abortSignal) {
        this.activeRequests.set(requestId, controller);
        
        // Listen for external abort signal
        abortSignal.addEventListener('abort', () => {
          console.log('🛑 Aborting backend request:', requestId);
          controller.abort();
          this.activeRequests.delete(requestId);
        });
      }

      const response = await fetch(`${this.baseUrl}/generate-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enhancedRequest),
        signal: controller.signal // NEW: Add abort signal to fetch
      });

      // NEW: Clean up request tracking
      this.activeRequests.delete(requestId);

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
      // NEW: Handle abort errors specifically
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 Backend request was cancelled');
        throw new Error('Request cancelled by user');
      }
      
      console.error('❌ Backend API call failed:', error);
      throw error;
    }
  }

  /**
   * PRESERVED: Original formatting instructions method
   */
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

  /**
   * PRESERVED: Original health check method with enhanced cancellation support
   */
  async healthCheck(): Promise<boolean> {
    try {
      // NEW: Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal // NEW: Add abort signal
      });
      
      clearTimeout(timeoutId);
      const isHealthy = response.ok;
      
      if (isHealthy) {
        const data = await response.json();
        console.log('💚 Backend health check passed:', data);
      }
      
      return isHealthy;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('🔴 Backend health check timed out');
      } else {
        console.warn('🔴 Backend health check failed:', error);
      }
      return false;
    }
  }

  /**
   * PRESERVED: Original test connection method
   */
  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log('🔍 Testing backend connection...');
      
      // NEW: Add timeout for connection test
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection test timed out'
        };
      }
      
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * PRESERVED: Original test feedback generation method
   */
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

  /**
   * NEW: Cancel all active requests
   */
  cancelAllRequests(): void {
    console.log(`🛑 Cancelling ${this.activeRequests.size} active backend requests`);
    
    this.activeRequests.forEach((controller, requestId) => {
      console.log(`🛑 Aborting request: ${requestId}`);
      controller.abort();
    });
    
    this.activeRequests.clear();
  }

  /**
   * NEW: Get count of active requests
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  /**
   * NEW: Cancel a specific request by ID
   */
  cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      console.log(`🛑 Cancelling specific request: ${requestId}`);
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * NEW: Get list of active request IDs
   */
  getActiveRequestIds(): string[] {
    return Array.from(this.activeRequests.keys());
  }

  /**
   * NEW: Check if a specific request is active
   */
  isRequestActive(requestId: string): boolean {
    return this.activeRequests.has(requestId);
  }
}

export const backendApiService = new BackendApiService();