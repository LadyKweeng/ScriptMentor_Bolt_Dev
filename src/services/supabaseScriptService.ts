import { supabase } from '../utils/supabaseClient';
import { Feedback, ScriptRewrite, Character, FullScript } from '../types';
import { EncryptionService, EncryptedData } from '../utils/encryptionService';

export interface SupabaseScript {
  id: string;
  title: string;
  content: string | EncryptedData; // Can be encrypted
  processed_content: string | EncryptedData; // Can be encrypted
  characters: Record<string, Character>;
  feedback?: Feedback;
  rewrite?: ScriptRewrite;
  diff_lines?: string[];
  file_size: number;
  created_at: string;
  last_accessed: string;
  user_id: string;
  // New fields for chunked scripts
  chunks?: FullScript['chunks'];
  chunking_strategy?: FullScript['chunkingStrategy'];
  total_pages?: number;
  is_chunked?: boolean;
  // Encryption metadata
  is_encrypted?: boolean;
  encryption_version?: string;
}

export class SupabaseScriptService {
  private userCache: string | null = null;
  private authPromise: Promise<string> | null = null;
  private static readonly ENCRYPTION_VERSION = '1.0';

  /**
   * Get authenticated user ID with caching
   */
  private async getAuthenticatedUserId(): Promise<string> {
    // Return cached user ID if available
    if (this.userCache) {
      return this.userCache;
    }

    // Return existing auth promise if one is pending
    if (this.authPromise) {
      return this.authPromise;
    }

    // Create new auth promise
    this.authPromise = this.fetchUserId();
    
    try {
      const userId = await this.authPromise;
      this.userCache = userId;
      return userId;
    } finally {
      this.authPromise = null;
    }
  }

  private async fetchUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    return user.id;
  }

  /**
   * Clear user cache (call on sign out)
   */
  clearUserCache(): void {
    this.userCache = null;
    this.authPromise = null;
  }

  /**
   * Enhanced function to safely check and convert encrypted data
   * Handles potential JSON parsing issues from Supabase
   */
  private parseEncryptedData(content: any): EncryptedData | string {
    // If already a string, return as-is
    if (typeof content === 'string') {
      try {
        // Try to parse as JSON in case it's stringified encrypted data
        const parsed = JSON.parse(content);
        if (this.isValidEncryptedData(parsed)) {
          console.log('🔧 Parsed stringified encrypted data from database');
          return parsed;
        }
        // If JSON parse succeeds but isn't encrypted data, return original string
        return content;
      } catch {
        // If JSON parse fails, it's just a plain string
        return content;
      }
    }
    
    // If it's an object, check if it's valid encrypted data
    if (typeof content === 'object' && content !== null) {
      if (this.isValidEncryptedData(content)) {
        return content;
      }
    }
    
    // Fallback: return as string
    console.warn('⚠️ Content format unrecognized, treating as plain text:', typeof content);
    return String(content);
  }

  /**
   * Enhanced validation for encrypted data structure
   */
  private isValidEncryptedData(data: any): data is EncryptedData {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.encryptedContent === 'string' &&
      typeof data.iv === 'string' &&
      typeof data.salt === 'string' &&
      data.encryptedContent.length > 0 &&
      data.iv.length > 0 &&
      data.salt.length > 0
    );
  }

  /**
   * Enhanced decryption with better error handling and logging
   */
  private async safeDecryptContent(
    content: any, 
    userId: string, 
    fieldName: string
  ): Promise<string> {
    const parsedContent = this.parseEncryptedData(content);
    
    if (typeof parsedContent === 'string') {
      console.log(`📝 ${fieldName} is already decrypted or was never encrypted`);
      return parsedContent;
    }
    
    try {
      console.log(`🔓 Decrypting ${fieldName}...`, {
        hasEncryptedContent: !!parsedContent.encryptedContent,
        hasIV: !!parsedContent.iv,
        hasSalt: !!parsedContent.salt,
        version: parsedContent.version || 'legacy'
      });
      
      const decryptedContent = await EncryptionService.decryptContent(parsedContent, userId);
      console.log(`✅ Successfully decrypted ${fieldName}:`, {
        originalLength: parsedContent.encryptedContent?.length || 0,
        decryptedLength: decryptedContent.length
      });
      
      return decryptedContent;
    } catch (error) {
      console.error(`❌ Failed to decrypt ${fieldName}:`, error);
      throw new Error(`Failed to decrypt ${fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save a script to Supabase with encryption (ALWAYS enabled)
   */
  async saveScript(
    originalContent: string,
    title: string,
    processedContent: string,
    characters: Record<string, Character>,
    feedback?: Feedback,
    rewrite?: ScriptRewrite,
    diffLines?: string[],
    fullScript?: FullScript
  ): Promise<string> {
    try {
      const userId = await this.getAuthenticatedUserId();

      console.log('💾 Saving script with encryption enabled...', {
        title,
        contentLength: originalContent.length,
        processedLength: processedContent.length,
        isChunked: Boolean(fullScript?.chunks && fullScript.chunks.length > 1)
      });

      // ALWAYS encrypt sensitive content
      console.log('🔒 Encrypting script content before saving...');
      
      // Encrypt main content
      const encryptedContent = await EncryptionService.encryptContent(originalContent, userId);
      const encryptedProcessedContent = await EncryptionService.encryptContent(processedContent, userId);
      
      // Encrypt chunk content if present
      let encryptedChunks = fullScript?.chunks;
      if (fullScript?.chunks) {
        console.log('🔒 Encrypting chunk content...');
        encryptedChunks = await Promise.all(
          fullScript.chunks.map(async (chunk) => ({
            ...chunk,
            content: await EncryptionService.encryptContent(chunk.content, userId)
          }))
        );
      }

      const scriptData = {
        title, // Title remains unencrypted for searchability
        content: encryptedContent,
        processed_content: encryptedProcessedContent,
        characters, // Characters remain unencrypted for functionality
        feedback,
        rewrite,
        diff_lines: diffLines,
        file_size: originalContent.length,
        last_accessed: new Date().toISOString(),
        user_id: userId,
        // Chunked script fields
        chunks: encryptedChunks,
        chunking_strategy: fullScript?.chunkingStrategy,
        total_pages: fullScript?.totalPages,
        is_chunked: Boolean(fullScript?.chunks && fullScript.chunks.length > 1),
        // Encryption metadata - ALWAYS true
        is_encrypted: true,
        encryption_version: SupabaseScriptService.ENCRYPTION_VERSION
      };

      const { data, error } = await supabase
        .from('scripts')
        .insert(scriptData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      // FIXED: Ensure we return the proper UUID from database
      const databaseUUID = data.id;
      console.log('✅ Script saved to Supabase with encryption:', {
        id: databaseUUID,
        title: data.title,
        isChunked: data.is_chunked,
        isEncrypted: data.is_encrypted,
        uuidType: typeof databaseUUID
      });

      // Validate that we got a proper UUID
      if (!databaseUUID || typeof databaseUUID !== 'string') {
        throw new Error('Failed to get valid script ID from database');
      }

      return databaseUUID;
    } catch (error) {
      console.error('❌ Failed to save script to Supabase:', error);
      throw error;
    }
  }

  /**
   * Get a script from Supabase with ENHANCED decryption handling
   */
  async getScript(scriptId: string): Promise<SupabaseScript | null> {
    try {
      const userId = await this.getAuthenticatedUserId();

      console.log('📖 Retrieving script from Supabase...', {
        scriptId,
        userId: userId.substring(0, 8) + '...'
      });

      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .eq('id', scriptId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          console.log('📖 Script not found:', scriptId);
          return null;
        }
        throw error;
      }

      console.log('📖 Script retrieved from database:', {
        id: data.id,
        title: data.title,
        isEncrypted: data.is_encrypted,
        hasContent: !!data.content,
        hasProcessedContent: !!data.processed_content,
        contentType: typeof data.content,
        processedContentType: typeof data.processed_content
      });

      // ENHANCED DECRYPTION LOGIC
      if (data.is_encrypted) {
        console.log('🔓 Starting enhanced decryption process...', {
          scriptId: data.id,
          title: data.title,
          encryptionVersion: data.encryption_version || 'legacy'
        });
        
        try {
          // Decrypt main content with enhanced handling
          if (data.content) {
            console.log('🔓 Processing main content for decryption...');
            data.content = await this.safeDecryptContent(data.content, userId, 'main content');
          }
          
          if (data.processed_content) {
            console.log('🔓 Processing processed content for decryption...');
            data.processed_content = await this.safeDecryptContent(data.processed_content, userId, 'processed content');
          }
          
          // Decrypt chunk content if present
          if (data.chunks && Array.isArray(data.chunks)) {
            console.log('🔓 Processing chunk content for decryption...', {
              chunkCount: data.chunks.length
            });
            
            data.chunks = await Promise.all(
              data.chunks.map(async (chunk: any, index: number) => {
                if (chunk.content) {
                  try {
                    console.log(`🔓 Decrypting chunk ${index + 1}/${data.chunks.length}...`);
                    const decryptedContent = await this.safeDecryptContent(
                      chunk.content, 
                      userId, 
                      `chunk ${index + 1} content`
                    );
                    return {
                      ...chunk,
                      content: decryptedContent
                    };
                  } catch (chunkError) {
                    console.error(`❌ Failed to decrypt chunk ${index + 1}:`, chunkError);
                    // Return chunk with error marker instead of failing completely
                    return {
                      ...chunk,
                      content: `[DECRYPTION FAILED: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}]`,
                      decryptionError: true
                    };
                  }
                }
                return chunk;
              })
            );
          }
          
          console.log('✅ Enhanced decryption process completed successfully', {
            scriptId: data.id,
            title: data.title,
            contentDecrypted: !!(data.content && typeof data.content === 'string'),
            processedContentDecrypted: !!(data.processed_content && typeof data.processed_content === 'string'),
            chunksProcessed: data.chunks?.length || 0
          });
          
        } catch (decryptionError) {
          console.error('❌ Enhanced decryption process failed:', decryptionError);
          throw new Error(`Failed to decrypt script content: ${decryptionError instanceof Error ? decryptionError.message : 'Unknown decryption error'}. The script may be corrupted or you may not have permission to access it.`);
        }
      } else {
        console.log('📝 Script is not encrypted, using content as-is');
      }

      // Update last accessed time asynchronously (don't await)
      this.updateLastAccessedAsync(scriptId).catch(console.warn);

      console.log('✅ Script retrieval and processing complete:', {
        id: data.id,
        title: data.title,
        isChunked: data.is_chunked,
        isEncrypted: data.is_encrypted,
        finalContentLength: typeof data.content === 'string' ? data.content.length : 0,
        finalProcessedContentLength: typeof data.processed_content === 'string' ? data.processed_content.length : 0
      });

      return data;
    } catch (error) {
      console.error('❌ Failed to get script from Supabase:', error);
      throw error;
    }
  }

  /**
   * Get all scripts for the current user with optimized query and decryption
   */
  async getAllScripts(): Promise<SupabaseScript[]> {
    try {
      const userId = await this.getAuthenticatedUserId();

      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .eq('user_id', userId)
        .order('last_accessed', { ascending: false })
        .limit(100); // Add reasonable limit to prevent performance issues

      if (error) {
        throw error;
      }

      // For list view, we don't need to decrypt content - just mark encryption status
      const scriptsWithEncryptionStatus = (data || []).map(script => {
        if (script.is_encrypted) {
          console.log(`🔐 Script "${script.title}" is encrypted and protected`);
        }
        return script;
      });

      console.log('📚 Retrieved scripts from Supabase:', {
        count: scriptsWithEncryptionStatus.length,
        chunkedScripts: scriptsWithEncryptionStatus.filter(s => s.is_chunked).length,
        encryptedScripts: scriptsWithEncryptionStatus.filter(s => s.is_encrypted).length
      });

      return scriptsWithEncryptionStatus;
    } catch (error) {
      console.error('❌ Failed to get all scripts from Supabase:', error);
      throw error;
    }
  }

  /**
   * Update a script in Supabase with encryption support
   */
  async updateScript(
    scriptId: string,
    updates: Partial<Omit<SupabaseScript, 'id' | 'user_id' | 'created_at'>>
  ): Promise<void> {
    try {
      const userId = await this.getAuthenticatedUserId();

      // ALWAYS encrypt content fields
      if (updates.content && typeof updates.content === 'string') {
        updates.content = await EncryptionService.encryptContent(updates.content, userId);
      }
      
      if (updates.processed_content && typeof updates.processed_content === 'string') {
        updates.processed_content = await EncryptionService.encryptContent(updates.processed_content, userId);
      }

      const finalUpdates = {
        ...updates,
        last_accessed: new Date().toISOString(),
        is_encrypted: true, // ALWAYS true
        encryption_version: SupabaseScriptService.ENCRYPTION_VERSION
      };

      const { error } = await supabase
        .from('scripts')
        .update(finalUpdates)
        .eq('id', scriptId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      console.log('✅ Script updated in Supabase:', scriptId);
    } catch (error) {
      console.error('❌ Failed to update script in Supabase:', error);
      throw error;
    }
  }

  /**
   * Delete a script from Supabase
   */
  async deleteScript(scriptId: string): Promise<void> {
    try {
      const userId = await this.getAuthenticatedUserId();

      const { error } = await supabase
        .from('scripts')
        .delete()
        .eq('id', scriptId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      console.log('🗑️ Script deleted from Supabase:', scriptId);
    } catch (error) {
      console.error('❌ Failed to delete script from Supabase:', error);
      throw error;
    }
  }

  /**
   * Update last accessed time asynchronously
   */
  private async updateLastAccessedAsync(scriptId: string): Promise<void> {
    try {
      const userId = this.userCache; // Use cached user ID for async update
      if (!userId) return;

      await supabase
        .from('scripts')
        .update({ last_accessed: new Date().toISOString() })
        .eq('id', scriptId)
        .eq('user_id', userId);
    } catch (error) {
      // Don't throw on this non-critical update
      console.warn('Failed to update last accessed time:', error);
    }
  }

  /**
   * Get scripts by type (chunked vs single)
   */
  async getScriptsByType(type: 'chunked' | 'single'): Promise<SupabaseScript[]> {
    try {
      const userId = await this.getAuthenticatedUserId();

      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_chunked', type === 'chunked')
        .order('last_accessed', { ascending: false })
        .limit(50); // Add limit for performance

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Failed to get scripts by type from Supabase:', error);
      throw error;
    }
  }

  /**
   * Search scripts by title (content search disabled for encrypted scripts)
   */
  async searchScripts(query: string): Promise<SupabaseScript[]> {
    try {
      const userId = await this.getAuthenticatedUserId();

      // Only search by title for encrypted scripts to maintain privacy
      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .eq('user_id', userId)
        .ilike('title', `%${query}%`)
        .order('last_accessed', { ascending: false })
        .limit(25); // Add limit for search performance

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Failed to search scripts in Supabase:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics with encryption info - FIXED to handle missing columns gracefully
   */
  async getCacheStats(): Promise<{
    scriptCount: number;
    chunkedScripts: number;
    singleScenes: number;
    encryptedScripts: number;
    totalStorageUsed: number;
    oldestScriptDate: Date | null;
  }> {
    try {
      const userId = await this.getAuthenticatedUserId();

      // First, check what columns exist in the scripts table
      const { data: columnCheck, error: columnError } = await supabase
        .from('scripts')
        .select('id, is_chunked, file_size, created_at')
        .eq('user_id', userId)
        .limit(1);

      if (columnError) {
        console.warn('Column check failed:', columnError);
        // Return default stats if we can't check columns
        return {
          scriptCount: 0,
          chunkedScripts: 0,
          singleScenes: 0,
          encryptedScripts: 0,
          totalStorageUsed: 0,
          oldestScriptDate: null
        };
      }

      // Now try to get stats with encryption column if it exists
      let selectFields = 'is_chunked, file_size, created_at';
      
      // Try to include is_encrypted if it exists
      try {
        const { data: encryptionTest } = await supabase
          .from('scripts')
          .select('is_encrypted')
          .eq('user_id', userId)
          .limit(1);
        
        // If no error, the column exists
        selectFields += ', is_encrypted';
      } catch (encryptionError) {
        console.log('is_encrypted column not available, proceeding without it');
      }

      const { data: stats, error: statsError } = await supabase
        .from('scripts')
        .select(selectFields)
        .eq('user_id', userId);

      if (statsError) {
        throw statsError;
      }

      const scripts = stats || [];
      
      const result = {
        scriptCount: scripts.length,
        chunkedScripts: scripts.filter(s => s.is_chunked).length,
        singleScenes: scripts.filter(s => !s.is_chunked).length,
        encryptedScripts: scripts.filter(s => s.is_encrypted).length || 0, // Default to 0 if column doesn't exist
        totalStorageUsed: scripts.reduce((total, script) => total + (script.file_size || 0), 0),
        oldestScriptDate: scripts.length > 0 
          ? new Date(Math.min(...scripts.map(s => new Date(s.created_at).getTime())))
          : null
      };

      return result;
    } catch (error) {
      console.error('❌ Failed to get cache stats from Supabase:', error);
      return {
        scriptCount: 0,
        chunkedScripts: 0,
        singleScenes: 0,
        encryptedScripts: 0,
        totalStorageUsed: 0,
        oldestScriptDate: null
      };
    }
  }

  /**
   * Clean up old scripts (older than specified days)
   */
  async cleanupCache(maxAgeDays: number = 30): Promise<{
    deletedOld: number;
    freedSpace: number;
  }> {
    try {
      const userId = await this.getAuthenticatedUserId();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

      // Get old scripts first to calculate freed space
      const { data: oldScripts, error: selectError } = await supabase
        .from('scripts')
        .select('file_size')
        .eq('user_id', userId)
        .lt('created_at', cutoffDate.toISOString());

      if (selectError) {
        throw selectError;
      }

      const freedSpace = (oldScripts || []).reduce((total, script) => total + script.file_size, 0);

      // Delete old scripts
      const { error: deleteError } = await supabase
        .from('scripts')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', cutoffDate.toISOString());

      if (deleteError) {
        throw deleteError;
      }

      const deletedCount = oldScripts?.length || 0;

      console.log(`🧹 Cleaned up ${deletedCount} old scripts from Supabase`);

      return {
        deletedOld: deletedCount,
        freedSpace: freedSpace / (1024 * 1024) // Convert to MB
      };
    } catch (error) {
      console.error('❌ Failed to cleanup cache in Supabase:', error);
      return {
        deletedOld: 0,
        freedSpace: 0
      };
    }
  }

  /**
   * Get script summary (lightweight version for lists)
   */
  async getScriptSummaries(): Promise<Pick<SupabaseScript, 'id' | 'title' | 'created_at' | 'last_accessed' | 'is_chunked' | 'file_size' | 'is_encrypted'>[]> {
    try {
      const userId = await this.getAuthenticatedUserId();

      // Try with encryption column first, fall back without it
      let selectFields = 'id, title, created_at, last_accessed, is_chunked, file_size';
      
      try {
        const { data: encryptionTest } = await supabase
          .from('scripts')
          .select('is_encrypted')
          .eq('user_id', userId)
          .limit(1);
        
        selectFields += ', is_encrypted';
      } catch {
        console.log('is_encrypted column not available for summaries');
      }

      const { data, error } = await supabase
        .from('scripts')
        .select(selectFields)
        .eq('user_id', userId)
        .order('last_accessed', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Failed to get script summaries from Supabase:', error);
      throw error;
    }
  }

  /**
   * MIGRATION UTILITY: Encrypt existing plain text scripts
   * This should be called once to migrate existing data
   */
  async migrateExistingScriptsToEncryption(): Promise<{
    migrated: number;
    failed: number;
    alreadyEncrypted: number;
  }> {
    try {
      const userId = await this.getAuthenticatedUserId();
      
      console.log('🔄 Starting migration of existing scripts to encryption...');

      // Get all unencrypted scripts for this user
      const { data: unencryptedScripts, error } = await supabase
        .from('scripts')
        .select('*')
        .eq('user_id', userId)
        .or('is_encrypted.is.null,is_encrypted.eq.false');

      if (error) {
        throw error;
      }

      if (!unencryptedScripts || unencryptedScripts.length === 0) {
        console.log('✅ No scripts need migration - all are already encrypted');
        return { migrated: 0, failed: 0, alreadyEncrypted: 0 };
      }

      console.log(`🔄 Found ${unencryptedScripts.length} scripts to migrate`);

      let migrated = 0;
      let failed = 0;

      for (const script of unencryptedScripts) {
        try {
          console.log(`🔒 Migrating script: ${script.title}`);

          // Encrypt content fields
          const encryptedContent = await EncryptionService.encryptContent(script.content, userId);
          const encryptedProcessedContent = await EncryptionService.encryptContent(script.processed_content, userId);

          // Encrypt chunks if present
          let encryptedChunks = script.chunks;
          if (script.chunks && Array.isArray(script.chunks)) {
            encryptedChunks = await Promise.all(
              script.chunks.map(async (chunk: any) => ({
                ...chunk,
                content: await EncryptionService.encryptContent(chunk.content, userId)
              }))
            );
          }

          // Update the script with encrypted content
          const { error: updateError } = await supabase
            .from('scripts')
            .update({
              content: encryptedContent,
              processed_content: encryptedProcessedContent,
              chunks: encryptedChunks,
              is_encrypted: true,
              encryption_version: SupabaseScriptService.ENCRYPTION_VERSION,
              last_accessed: new Date().toISOString()
            })
            .eq('id', script.id)
            .eq('user_id', userId);

          if (updateError) {
            console.error(`❌ Failed to migrate script ${script.id}:`, updateError);
            failed++;
          } else {
            console.log(`✅ Successfully migrated script: ${script.title}`);
            migrated++;
          }
        } catch (scriptError) {
          console.error(`❌ Failed to encrypt script ${script.id}:`, scriptError);
          failed++;
        }
      }

      console.log(`🎉 Migration complete: ${migrated} migrated, ${failed} failed`);

      return { migrated, failed, alreadyEncrypted: 0 };
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const supabaseScriptService = new SupabaseScriptService();

// Export function to clear cache on sign out
export const clearSupabaseCache = () => {
  supabaseScriptService.clearUserCache();
};