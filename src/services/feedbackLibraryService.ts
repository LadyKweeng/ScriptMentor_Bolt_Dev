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

      // FIXED: Validate required fields before attempting save
      if (!scriptId || scriptId.trim() === '') {
        console.error('❌ Missing script ID for feedback library save:', { scriptId, scriptTitle, mentorIds });
        throw new Error('Missing or invalid script ID for feedback library save');
      }

      if (!scriptTitle || scriptTitle.trim() === '') {
        console.error('❌ Missing script title for feedback library save:', { scriptId, scriptTitle, mentorIds });
        throw new Error('Missing or invalid script title for feedback library save');
      }

      if (!mentorIds || mentorIds.length === 0) {
        console.error('❌ Missing mentor IDs for feedback library save:', { scriptId, scriptTitle, mentorIds });
        throw new Error('Missing mentor IDs for feedback library save');
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
        script_id: scriptId,
        title: scriptTitle.substring(0, 255), // FIXED: Ensure title doesn't exceed database limit
        mentor_ids: mentorIds,
        mentor_names: mentorNames.substring(0, 255), // FIXED: Ensure names don't exceed limit
        pages: pages.substring(0, 100), // FIXED: Ensure pages don't exceed limit
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