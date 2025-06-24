// src/services/feedbackLibraryService.ts
import { supabase } from '../utils/supabaseClient';
import { EncryptionService } from '../utils/encryptionService';
import { Feedback, WriterSuggestionsResponse } from '../types';

export interface FeedbackLibraryItem {
  id: string;
  script_id: string;
  title: string;
  mentor_ids: string[];
  mentor_names: string;
  pages: string;
  type: 'feedback' | 'writer_suggestions';
  content: any;
  created_at: string;
  user_id: string;
  is_encrypted: boolean;
  encryption_version: string;
}

export class FeedbackLibraryService {
  private static readonly ENCRYPTION_VERSION = 'v1';

  /**
   * Get authenticated user ID
   */
  private async getAuthenticatedUserId(): Promise<string> {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session?.user?.id) {
      throw new Error('User not authenticated');
    }
    
    return session.user.id;
  }

  /**
 * NEW: Validate and normalize script ID to ensure it's a valid UUID
 */
private async validateAndNormalizeScriptId(scriptId: string, userId: string): Promise<string | null> {
  // Check if it's already a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(scriptId)) {
    console.log('✅ Script ID is already a valid UUID:', scriptId);
    return scriptId;
  }
  
  // If it's a string-based ID, try to find the corresponding UUID in the database
  console.log('🔍 String-based script ID detected, searching for corresponding UUID...', scriptId);
  
  try {
    // Search for script by title if the ID contains the title
    let searchQuery = '';
    if (scriptId.startsWith('script_')) {
      // Extract title from string ID (e.g., "script_WAGMI_032725_1750788051187" -> "WAGMI 032725")
      const titlePart = scriptId.replace('script_', '').replace(/_/g, ' ').replace(/\d{13}$/, '').trim();
      searchQuery = titlePart;
    }
    
    if (searchQuery) {
      const { data: scripts, error } = await supabase
        .from('scripts')
        .select('id, title')
        .eq('user_id', userId)
        .ilike('title', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!error && scripts && scripts.length > 0) {
        const foundUUID = scripts[0].id;
        console.log('✅ Found corresponding UUID for script:', { 
          originalId: scriptId, 
          foundUUID, 
          title: scripts[0].title 
        });
        return foundUUID;
      }
    }
    
      // If no match found, generate a new UUID that will be accepted by Supabase
      console.warn('⚠️ No corresponding UUID found for script ID, generating fallback UUID:', scriptId);
      return crypto.randomUUID();

    } catch (error) {
      console.error('❌ Error validating script ID:', error);
      return crypto.randomUUID(); // Generate fallback UUID on error too
    }
  }

  /**
   * Enhanced validation specifically for blended feedback with better fallback handling
   */
  private async validateBlendedFeedbackContext(
    scriptId: string,
    scriptTitle: string,
    mentorIds: string[],
    userId: string
  ): Promise<{ validScriptId: string; validMentorIds: string[]; validMentorNames: string }> {
    // Validate script ID
    let validScriptId = await this.validateAndNormalizeScriptId(scriptId, userId);

    // If still no valid script ID, generate one
    if (!validScriptId) {
      validScriptId = crypto.randomUUID();
      console.log('🔧 Generated fallback UUID for blended feedback:', validScriptId);
    }

    // Validate mentor IDs for blended feedback
    let validMentorIds = mentorIds;
    if (!validMentorIds || validMentorIds.length === 0) {
      validMentorIds = ['blended'];
      console.log('🔧 Using fallback mentor IDs for blended feedback:', validMentorIds);
    }

    // Create mentor names string
    const validMentorNames = validMentorIds.includes('blended')
      ? 'Blended Mentors'
      : validMentorIds.join(', ');

    return { validScriptId, validMentorIds, validMentorNames };
  }

  /**
   * Save complete feedback session to library with encryption
   */
  async saveFeedbackSessionToLibrary(
    scriptId: string,
    scriptTitle: string,
    mentorIds: string[],
    mentorNames: string,
    pages: string,
    feedback: Feedback,
    scriptContent?: string
  ): Promise<string> {
    try {
      const userId = await this.getAuthenticatedUserId();

      console.log('💾 Saving feedback to library with encryption...', {
        scriptId,
        scriptTitle,
        mentorIds,
        mentorNames,
        pages,
        feedbackId: feedback.id,
        userId: userId.substring(0, 8) + '...',
        hasScriptContent: !!scriptContent,
        feedbackType: feedback.isChunked ? 'chunked' : 'single'
      });

      // ENHANCED: Validate and handle script ID format
      const validatedScriptId = await this.validateAndNormalizeScriptId(scriptId, userId);

      if (!validatedScriptId) {
        console.error('❌ Invalid script ID for feedback library save:', { scriptId, scriptTitle, mentorIds });
        throw new Error('Invalid script ID format - cannot save to feedback library');
      }

      if (!scriptTitle || scriptTitle.trim() === '') {
        console.error('❌ Missing script title for feedback library save:', { scriptId, scriptTitle, mentorIds });
        throw new Error('Missing or invalid script title for feedback library save');
      }

      // ENHANCED: Special handling for blended feedback
      const isBlendedFeedback = feedback.mentorId === 'blended';
      let validatedMentorIds = mentorIds;
      let validatedMentorNames = mentorNames;

      if (isBlendedFeedback) {
        // For blended feedback, ensure we have proper mentor data
        if (!validatedMentorIds || validatedMentorIds.length === 0) {
          validatedMentorIds = ['blended'];
          console.log('🔧 Using fallback mentor IDs for blended feedback:', validatedMentorIds);
        }

        if (!validatedMentorNames || validatedMentorNames.trim() === '') {
          validatedMentorNames = 'Blended Mentors';
          console.log('🔧 Using fallback mentor names for blended feedback:', validatedMentorNames);
        }
      } else {
        // Original validation for non-blended feedback
        if (!validatedMentorIds || validatedMentorIds.length === 0) {
          console.error('❌ Missing mentor IDs for feedback library save:', { scriptId, scriptTitle, mentorIds });
          throw new Error('Missing mentor IDs for feedback library save');
        }
      }
      // Create complete feedback session object
      const feedbackSession = {
        feedback: feedback,
        scriptContent: scriptContent,
        sessionType: 'complete_feedback',
        timestamp: new Date().toISOString(),
        version: '1.0',
        // NEW: Include overview content if available
        overviewContent: (feedback as any).overviewContent || null
      };

      // Encrypt the complete session
      const encryptedContent = await EncryptionService.encryptContent(
        JSON.stringify(feedbackSession), 
        userId
      );

      // FIXED: Validate required fields before insertion
      if (!scriptId || !scriptTitle || !mentorIds.length) {
        throw new Error('Missing required fields for feedback library save');
      }

      const feedbackData = {
        script_id: validatedScriptId,
        title: scriptTitle.substring(0, 255),
        mentor_ids: validatedMentorIds,
        mentor_names: validatedMentorNames.substring(0, 255),
        pages: pages.substring(0, 100),
        type: 'feedback' as const,
        content: encryptedContent,
        user_id: userId,
        is_encrypted: true,
        encryption_version: FeedbackLibraryService.ENCRYPTION_VERSION
      };

      const { data, error } = await supabase
        .from('feedback_library')
        .insert(feedbackData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        // FIXED: Provide more helpful error context
        console.error('Failed insertion data:', {
          script_id: feedbackData.script_id,
          title: feedbackData.title,
          mentor_ids: feedbackData.mentor_ids,
          user_id: feedbackData.user_id
        });
        throw new Error(`Database insertion failed: ${error.message}`);
      }

      console.log('✅ Feedback saved to library:', data.id);
      return data.id;
    } catch (error) {
      console.error('❌ Failed to save feedback to library:', error);
      throw error;
    }
  }

  /**
 * Save writer suggestions to library with encryption
 */
  async saveWriterSuggestionsToLibrary(
    scriptId: string,
    scriptTitle: string,
    mentorIds: string[],
    mentorNames: string,
    pages: string,
    suggestions: WriterSuggestionsResponse | any,
    originalFeedback?: Feedback
  ): Promise<string> {
    try {
      const userId = await this.getAuthenticatedUserId();

      console.log('💾 Saving writer suggestions to library with enhanced session...', {
        scriptTitle,
        mentorNames,
        pages,
        hasOriginalFeedback: !!originalFeedback,
        sessionType: suggestions.sessionType || 'legacy'
      });

   // ENHANCED: Create complete writer suggestions session with better validation
      const writerSuggestionsSession = {
        // Core suggestions data - handle both legacy and enhanced formats
        suggestions: suggestions.suggestions || [],
        success: suggestions.success !== undefined ? suggestions.success : true,
        mentor_id: suggestions.mentor_id || mentorIds[0],
        timestamp: suggestions.timestamp || new Date().toISOString(),
        
        // NEW: Session metadata with validation
        sessionType: suggestions.sessionType || 'writer_suggestions',
        originalFeedback: originalFeedback || suggestions.originalFeedback || null,
        
        // ENHANCED: Script context with comprehensive fallback
        scriptContext: suggestions.scriptContext || {
          scriptId,
          scriptTitle,
          pages,
          generatedFrom: 'feedback_session',
          savedAt: new Date().toISOString()
        },
        
        // Version tracking
        version: suggestions.version || '1.1'
      };

      console.log('📚 Saving enhanced writer suggestions session:', {
        sessionType: writerSuggestionsSession.sessionType,
        suggestionCount: writerSuggestionsSession.suggestions.length,
        hasOriginalFeedback: !!writerSuggestionsSession.originalFeedback,
        scriptContext: writerSuggestionsSession.scriptContext
      });

      // Encrypt the complete session
      const encryptedContent = await EncryptionService.encryptContent(
        JSON.stringify(writerSuggestionsSession),
        userId
      );

      const suggestionsData = {
        script_id: scriptId,
        title: `${scriptTitle} - Writer Suggestions`,
        mentor_ids: mentorIds,
        mentor_names: mentorNames,
        pages,
        type: 'writer_suggestions' as const,
        content: encryptedContent,
        user_id: userId,
        is_encrypted: true,
        encryption_version: FeedbackLibraryService.ENCRYPTION_VERSION
      };

      const { data, error } = await supabase
        .from('feedback_library')
        .insert(suggestionsData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log('✅ Feedback saved to library:', data.id);
      return data.id;
    } catch (error) {
      console.error('❌ Failed to save feedback to library:', error);
      throw error;
    }
  }

  /**
   * Get all feedback library items for current user
   */
  async getAllFeedbackLibraryItems(): Promise<FeedbackLibraryItem[]> {
    try {
      const userId = await this.getAuthenticatedUserId();

      const { data, error } = await supabase
        .from('feedback_library')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      console.log('📚 Retrieved feedback library items:', {
        count: data?.length || 0
      });

      return data || [];
    } catch (error) {
      console.error('❌ Failed to get feedback library items:', error);
      throw error;
    }
  }

  /**
   * Get and decrypt a specific feedback library item
   */
  async getFeedbackLibraryItem(itemId: string): Promise<any> {
    try {
      const userId = await this.getAuthenticatedUserId();

      const { data, error } = await supabase
        .from('feedback_library')
        .select('*')
        .eq('id', itemId)
        .eq('user_id', userId)
        .single();

      if (error) {
        throw error;
      }

      // Decrypt the content if encrypted
      if (data.is_encrypted && data.content) {
        try {
          const decryptedContent = await EncryptionService.decryptContent(
            data.content, 
            userId
          );
          data.content = JSON.parse(decryptedContent);
        } catch (decryptError) {
          console.error('❌ Failed to decrypt feedback library content:', decryptError);
          throw new Error('Failed to decrypt content');
        }
      }

      return data;
    } catch (error) {
      console.error('❌ Failed to get feedback library item:', error);
      throw error;
    }
  }

  /**
   * Delete a feedback library item
   */
  async deleteFeedbackLibraryItem(itemId: string): Promise<void> {
    try {
      const userId = await this.getAuthenticatedUserId();

      const { error } = await supabase
        .from('feedback_library')
        .delete()
        .eq('id', itemId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      console.log('✅ Feedback library item deleted:', itemId);
    } catch (error) {
      console.error('❌ Failed to delete feedback library item:', error);
      throw error;
    }
  }
}

export const feedbackLibraryService = new FeedbackLibraryService();