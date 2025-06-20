// src/services/backendApiService.ts - Complete enhanced version with token integration + ALL original features
import { TokenUsage } from '../types';

// PRESERVED: Original interfaces
interface BackendFeedbackRequest {
  scene_content: string;
  mentor_id: string;
  character_context?: string;
  feedback_mode: 'structured' | 'scratchpad';
  system_prompt: string;
  temperature: number;
  // NEW: Optional formatting instructions will be added automatically
}

interface BackendFeedbackResponse {
  success: boolean;
  feedback: string;
  mentor_id: string;
  feedback_mode: string;
  timestamp: string;
  error?: string;
}

// NEW: Enhanced interfaces for token-aware requests
interface TokenAwareApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  timestamp?: string;
}

interface TokenAwareRequest {
  userId?: string;
  actionType?: TokenUsage['action_type'];
}

class BackendApiService {
  private baseUrl: string;
  private activeRequests: Map<string, AbortController> = new Map(); // PRESERVED: Request tracking
  private healthCheckCache: { isHealthy: boolean; lastChecked: number } | null = null; // NEW: Health check caching
  private readonly HEALTH_CHECK_CACHE_DURATION = 30000; // 30 seconds

  constructor() {
    this.baseUrl = 'https://smbackend-production.up.railway.app/api';
  }

  /**
   * PRESERVED: Generate feedback with optional cancellation support
   * ENHANCED: Now supports AbortSignal while preserving all original functionality
   * IMPROVED: Added rate limit detection and automatic retry with exponential backoff
   */
  async generateFeedback(
    request: BackendFeedbackRequest, 
    abortSignal?: AbortSignal // PRESERVED: Optional abort signal
  ): Promise<string> {
    try {
      // PRESERVED: Add formatting instructions to request
      const enhancedRequest = {
        ...request,
        formatting_instructions: this.getFormattingInstructions(request.feedback_mode)
      };

      console.log('🚀 Sending enhanced feedback request:', {
        mentor_id: request.mentor_id,
        mode: request.feedback_mode,
        scene_length: request.scene_content.length,
        canCancel: !!abortSignal // PRESERVED: Log cancellation capability
      });

      // PRESERVED: Create abort controller if signal provided
      const controller = new AbortController();
      const requestId = `${request.mentor_id}-${Date.now()}`;
      
      // PRESERVED: Store controller for potential cancellation
      if (abortSignal) {
        this.activeRequests.set(requestId, controller);
        
        // Listen for external abort signal
        abortSignal.addEventListener('abort', () => {
          console.log('🛑 Aborting backend request:', requestId);
          controller.abort();
          this.activeRequests.delete(requestId);
        });
      }

      // IMPROVED: Add retry logic with exponential backoff
      let retryCount = 0;
      const maxRetries = 3;
      let lastError: Error | null = null;

      while (retryCount <= maxRetries) {
        try {
          // Check if already aborted before making request
          if (abortSignal?.aborted || controller.signal.aborted) {
            throw new Error('Request cancelled by user');
          }

          const response = await fetch(`${this.baseUrl}/generate-feedback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(enhancedRequest),
            signal: controller.signal // PRESERVED: Add abort signal to fetch
          });

          // PRESERVED: Clean up request tracking
          this.activeRequests.delete(requestId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = `Backend API Error: ${response.status} - ${errorData.message || response.statusText}`;
            
            // IMPROVED: Check for rate limit errors (429 status code)
            if (response.status === 429) {
              const rateLimitMessage = errorData.message || '';
              const waitTimeMatch = rateLimitMessage.match(/Please try again in (\d+\.\d+)s/);
              
              if (waitTimeMatch && waitTimeMatch[1]) {
                const waitTime = parseFloat(waitTimeMatch[1]) * 1000 + 1000; // Convert to ms and add 1 second buffer
                console.log(`🕒 Rate limit hit, waiting for ${waitTime/1000} seconds before retry...`);
                
                // Wait for the specified time plus 1 second
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                // Increment retry count and try again
                retryCount++;
                continue;
              }
            }
            
            throw new Error(errorMessage);
          }

          const data: BackendFeedbackResponse = await response.json();
          
          if (!data.success) {
            throw new Error(data.error || 'Feedback generation failed');
          }

          console.log('✅ Received formatted feedback from backend');
          return data.feedback;
        } catch (error) {
          // Store the error for potential re-throw
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // PRESERVED: Handle abort errors specifically
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('🛑 Backend request was cancelled');
            throw new Error('Request cancelled by user');
          }
          
          // IMPROVED: Handle rate limit errors from error message
          if (error instanceof Error && 
              (error.message.includes('rate limit') || 
               error.message.includes('429') || 
               error.message.includes('try again in'))) {
            
            // Extract wait time if available
            const waitTimeMatch = error.message.match(/try again in (\d+\.\d+)s/);
            let waitTime = Math.pow(2, retryCount) * 1000; // Default exponential backoff
            
            if (waitTimeMatch && waitTimeMatch[1]) {
              waitTime = parseFloat(waitTimeMatch[1]) * 1000 + 1000; // Convert to ms and add 1 second buffer
            }
            
            console.log(`🕒 Rate limit detected, waiting for ${waitTime/1000} seconds before retry...`);
            
            // Check if already aborted before waiting
            if (abortSignal?.aborted || controller.signal.aborted) {
              throw new Error('Request cancelled by user during rate limit wait');
            }
            
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
          
          // Check if already aborted before waiting
          if (abortSignal?.aborted || controller.signal.aborted) {
            throw new Error('Request cancelled by user during backoff wait');
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
      throw new Error('Unexpected error in generateFeedback');

    } catch (error) {
      // PRESERVED: Handle abort errors specifically
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
   * ENHANCED: Health check with caching and cancellation support
   */
  async healthCheck(): Promise<boolean> {
    const now = Date.now();
    
    // Return cached result if still valid
    if (this.healthCheckCache && 
        (now - this.healthCheckCache.lastChecked) < this.HEALTH_CHECK_CACHE_DURATION) {
      return this.healthCheckCache.isHealthy;
    }

    try {
      // PRESERVED: Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal // PRESERVED: Add abort signal
      });
      
      clearTimeout(timeoutId);
      const isHealthy = response.ok;
      
      // NEW: Cache the result
      this.healthCheckCache = {
        isHealthy,
        lastChecked: now
      };

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
      
      // NEW: Cache the failure
      this.healthCheckCache = {
        isHealthy: false,
        lastChecked: now
      };
      
      return false;
    }
  }

  /**
   * PRESERVED: Original test connection method
   */
  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log('🔍 Testing backend connection...');
      
      // PRESERVED: Add timeout for connection test
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
   * NEW: Enhanced request method for token-aware operations
   * IMPROVED: Added rate limit detection and automatic retry
   */
  async makeRequest<T = any>(
    endpoint: string, 
    options: RequestInit = {},
    tokenInfo?: { userId: string; actionType: TokenUsage['action_type'] }
  ): Promise<TokenAwareApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'ScriptMentor/2.0',
    };

    // Add token context headers if provided
    const headers = tokenInfo ? {
      ...defaultHeaders,
      'X-User-ID': tokenInfo.userId,
      'X-Action-Type': tokenInfo.actionType,
      ...options.headers
    } : {
      ...defaultHeaders,
      ...options.headers
    };

    const requestOptions: RequestInit = {
      ...options,
      headers,
      // Default timeout of 60 seconds for AI operations
      signal: options.signal || AbortSignal.timeout(60000)
    };

    // IMPROVED: Add retry logic with exponential backoff
    let retryCount = 0;
    const maxRetries = 3;
    let lastError: Error | null = null;

    while (retryCount <= maxRetries) {
      try {
        console.log(`🌐 Making API request to ${endpoint}${retryCount > 0 ? ` (retry ${retryCount}/${maxRetries})` : ''}`, {
          method: requestOptions.method || 'GET',
          hasBody: !!requestOptions.body,
          hasTokenInfo: !!tokenInfo
        });

        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          
          try {
            const errorBody = await response.text();
            if (errorBody) {
              const errorData = JSON.parse(errorBody);
              errorMessage = errorData.error || errorMessage;
            }
          } catch {
            // If we can't parse the error body, use the default message
          }
          
          // IMPROVED: Check for rate limit errors (429 status code)
          if (response.status === 429) {
            const waitTimeMatch = errorMessage.match(/try again in (\d+\.\d+)s/);
            let waitTime = Math.pow(2, retryCount) * 1000; // Default exponential backoff
            
            if (waitTimeMatch && waitTimeMatch[1]) {
              waitTime = parseFloat(waitTimeMatch[1]) * 1000 + 1000; // Convert to ms and add 1 second buffer
            }
            
            console.log(`🕒 Rate limit hit, waiting for ${waitTime/1000} seconds before retry...`);
            
            // Check if already aborted before waiting
            if (requestOptions.signal && (requestOptions.signal as AbortSignal).aborted) {
              throw new Error('Request cancelled by user during rate limit wait');
            }
            
            // Wait for the specified time
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Increment retry count and try again
            retryCount++;
            continue;
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        
        console.log(`✅ API request successful`, {
          endpoint,
          hasData: !!data,
          hasUsage: !!data.usage
        });

        return {
          success: true,
          data: data.data || data,
          usage: data.usage,
          timestamp: data.timestamp || new Date().toISOString()
        };

      } catch (error) {
        // Store the error for potential re-throw
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.error(`❌ API request failed for ${endpoint}:`, lastError);
        
        if (lastError.name === 'AbortError') {
          return {
            success: false,
            error: 'Request was cancelled or timed out'
          };
        }
        
        // IMPROVED: Check for rate limit errors in the error message
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
          
          // Check if already aborted before waiting
          if (requestOptions.signal && (requestOptions.signal as AbortSignal).aborted) {
            throw new Error('Request cancelled by user during rate limit wait');
          }
          
          // Wait for the specified time
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Increment retry count and try again
          retryCount++;
          continue;
        }
        
        // If we've reached max retries or it's not a rate limit error, return error response
        if (retryCount >= maxRetries || 
            !(lastError.message.includes('rate limit') || 
              lastError.message.includes('429') || 
              lastError.message.includes('try again in'))) {
          return {
            success: false,
            error: lastError.message
          };
        }
        
        // Otherwise, use exponential backoff
        const backoffTime = Math.pow(2, retryCount) * 1000;
        console.log(`⏱️ Retrying after ${backoffTime/1000} seconds (attempt ${retryCount + 1}/${maxRetries + 1})...`);
        
        // Check if already aborted before waiting
        if (requestOptions.signal && (requestOptions.signal as AbortSignal).aborted) {
          throw new Error('Request cancelled by user during backoff wait');
        }
        
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        retryCount++;
      }
    }
    
    // If we've exhausted all retries, return the last error
    return {
      success: false,
      error: lastError?.message || 'Request failed after multiple retries'
    };
  }

  /**
   * NEW: Generate dual feedback via backend API
   */
  async generateDualFeedback(
    scene: any,
    mentor: any,
    characters: any,
    tokenInfo?: { userId: string; actionType: TokenUsage['action_type'] }
  ): Promise<TokenAwareApiResponse<any>> {
    return this.makeRequest('/feedback/dual', {
      method: 'POST',
      body: JSON.stringify({
        scene,
        mentor,
        characters,
        modes: ['structured', 'scratchpad']
      })
    }, tokenInfo);
  }

  /**
   * NEW: Generate blended feedback via backend API
   */
  async generateBlendedFeedback(
    scene: any,
    mentors: any[],
    mentorWeights: Record<string, number>,
    characters: any,
    tokenInfo?: { userId: string; actionType: TokenUsage['action_type'] }
  ): Promise<TokenAwareApiResponse<any>> {
    return this.makeRequest('/feedback/blended', {
      method: 'POST',
      body: JSON.stringify({
        scene,
        mentors,
        mentorWeights,
        characters,
        modes: ['structured', 'scratchpad']
      })
    }, tokenInfo);
  }

  /**
   * NEW: Generate rewrite suggestions via backend API
   */
  async generateRewriteSuggestions(
    scene: any,
    mentor: any,
    characters: any,
    tokenInfo?: { userId: string; actionType: TokenUsage['action_type'] }
  ): Promise<TokenAwareApiResponse<any>> {
    return this.makeRequest('/rewrite/suggestions', {
      method: 'POST',
      body: JSON.stringify({
        scene,
        mentor,
        characters
      })
    }, tokenInfo);
  }

  /**
   * NEW: Generate writer agent analysis via backend API
   */
  async generateWriterAgent(
    feedbackText: string,
    mentorId: string,
    tokenInfo?: { userId: string; actionType: TokenUsage['action_type'] }
  ): Promise<TokenAwareApiResponse<any>> {
    return this.makeRequest('/writer-agent', {
      method: 'POST',
      body: JSON.stringify({
        feedback_text: feedbackText,
        mentor_id: mentorId
      })
    }, tokenInfo);
  }

  /**
   * PRESERVED: Cancel all active requests
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
   * PRESERVED: Get count of active requests
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  /**
   * PRESERVED: Cancel a specific request by ID
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
   * PRESERVED: Get list of active request IDs
   */
  getActiveRequestIds(): string[] {
    return Array.from(this.activeRequests.keys());
  }

  /**
   * PRESERVED: Check if a specific request is active
   */
  isRequestActive(requestId: string): boolean {
    return this.activeRequests.has(requestId);
  }

  /**
   * NEW: Enhanced script analysis via backend API
   */
  async generateEnhancedAnalysis(
    scene: any,
    mentor: any,
    characters: any,
    tokenInfo?: { userId: string; actionType: TokenUsage['action_type'] }
  ): Promise<TokenAwareApiResponse<any>> {
    return this.makeRequest('/feedback/enhanced', {
      method: 'POST',
      body: JSON.stringify({
        scene,
        mentor,
        characters,
        analysis_type: 'comprehensive'
      })
    }, tokenInfo);
  }

  /**
   * NEW: Batch feedback generation for multiple scenes/chunks
   */
  async generateBatchFeedback(
    requests: Array<{
      scene: any;
      mentor: any;
      characters: any;
    }>,
    tokenInfo?: { userId: string; actionType: TokenUsage['action_type'] }
  ): Promise<TokenAwareApiResponse<any[]>> {
    return this.makeRequest('/feedback/batch', {
      method: 'POST',
      body: JSON.stringify({
        requests,
        modes: ['structured', 'scratchpad']
      })
    }, tokenInfo);
  }

  /**
   * NEW: Get backend API usage statistics
   */
  async getApiUsageStats(userId: string): Promise<TokenAwareApiResponse<{
    totalRequests: number;
    requestsByType: Record<string, number>;
    averageResponseTime: number;
    lastRequestTime: string;
  }>> {
    return this.makeRequest(`/usage/stats/${userId}`, {
      method: 'GET'
    });
  }

  /**
   * NEW: Validate backend API key/authentication
   */
  async validateAuthentication(): Promise<TokenAwareApiResponse<{ isValid: boolean; expiresAt?: string }>> {
    return this.makeRequest('/auth/validate', {
      method: 'POST'
    });
  }

  /**
   * NEW: Get current backend API status and capabilities
   */
  async getApiStatus(): Promise<TokenAwareApiResponse<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    capabilities: string[];
    limitations: Record<string, any>;
  }>> {
    return this.makeRequest('/status', {
      method: 'GET'
    });
  }

  /**
   * NEW: Test connectivity and measure response time
   */
  async testConnectivity(): Promise<{
    isConnected: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await this.healthCheck();
      const responseTime = Date.now() - startTime;
      
      return {
        isConnected: isHealthy,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        isConnected: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * NEW: Get the base URL for the backend API
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * NEW: Set a custom base URL (useful for testing or environment switching)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    // Clear health check cache when URL changes
    this.healthCheckCache = null;
    console.log(`🔗 Backend API URL updated to: ${url}`);
  }

  /**
   * NEW: Generate analysis with specific prompt
   */
  async generateAnalysis(options: {
    prompt: string;
    analysisType: string;
    model?: string;
    temperature?: number;
  }): Promise<string> {
    try {
      // IMPROVED: Add retry logic with exponential backoff
      let retryCount = 0;
      const maxRetries = 3;
      let lastError: Error | null = null;

      while (retryCount <= maxRetries) {
        try {
          const response = await fetch(`${this.baseUrl}/openai-analysis`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
                { role: 'user', content: options.prompt }
              ],
              model: options.model || 'gpt-4o',
              temperature: options.temperature || 0.7,
              max_tokens: 4000
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = `Analysis API Error: ${response.status} - ${errorData.message || response.statusText}`;
            
            // IMPROVED: Check for rate limit errors (429 status code)
            if (response.status === 429) {
              const waitTimeMatch = errorMessage.match(/try again in (\d+\.\d+)s/);
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
          return data.content || '';
        } catch (error) {
          // Store the error for potential re-throw
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // IMPROVED: Check for rate limit errors in the error message
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
      
      // This should never be reached, but TypeScript requires a return
      throw new Error('Unexpected error in generateAnalysis');
    } catch (error) {
      console.error('❌ Analysis API call failed:', error);
      throw error;
    }
  }
}

export const backendApiService = new BackendApiService();