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
        scriptTitle,
        mentorNames,
        pages,
        feedbackId: feedback.id
      });

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

      const feedbackData = {
        script_id: scriptId,
        title: scriptTitle,
        mentor_ids: mentorIds,
        mentor_names: mentorNames,
        pages,
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
   * Save writer suggestions to library with encryption
   */
  async saveWriterSuggestionsToLibrary(
    scriptId: string,
    scriptTitle: string,
    mentorIds: string[],
    mentorNames: string,
    pages: string,
    suggestions: WriterSuggestionsResponse
  ): Promise<string> {
    try {
      const userId = await this.getAuthenticatedUserId();

      console.log('💾 Saving writer suggestions to library...', {
        scriptTitle,
        mentorNames,
        pages
      });

      // Encrypt the suggestions content
      const encryptedContent = await EncryptionService.encryptContent(
        JSON.stringify(suggestions), 
        userId
      );

      const suggestionsData = {
        script_id: scriptId,
        title: scriptTitle,
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