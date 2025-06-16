// src/components/ScriptLibrary.tsx - Enhanced with better error handling and debugging
import React, { useState, useEffect } from 'react';
import { supabaseScriptService, SupabaseScript } from '../services/supabaseScriptService';
import { supabase } from '../utils/supabaseClient';
import { BookOpen, Trash2, Clock, HardDrive, RefreshCw, Layers, FileText, Shield, ShieldCheck, Key, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

interface ScriptLibraryProps {
  onScriptSelected: (scriptId: string) => void;
}

const ScriptLibrary: React.FC<ScriptLibraryProps> = ({ onScriptSelected }) => {
  const [scripts, setScripts] = useState<SupabaseScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    migrated: number;
    failed: number;
    alreadyEncrypted: number;
  } | null>(null);
  const [cacheStats, setCacheStats] = useState<{
    scriptCount: number;
    chunkedScripts: number;
    singleScenes: number;
    encryptedScripts: number;
    totalSizeMB: number;
    oldestScriptDate: Date | null;
  }>({
    scriptCount: 0,
    chunkedScripts: 0,
    singleScenes: 0,
    encryptedScripts: 0,
    totalSizeMB: 0,
    oldestScriptDate: null
  });
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'authenticated' | 'unauthenticated'>('checking');

  // Load scripts on component mount
  useEffect(() => {
    loadScripts();
  }, []);

  // Enhanced connection and authentication check
  const checkSupabaseConnection = async (): Promise<{ 
    connected: boolean; 
    authenticated: boolean; 
    error?: string;
    details?: any;
  }> => {
    try {
      console.log('🔍 Checking Supabase connection and authentication...');
      
      // Check if Supabase client is properly configured
      if (!supabase) {
        return { 
          connected: false, 
          authenticated: false, 
          error: 'Supabase client not initialized',
          details: 'Check environment variables'
        };
      }

      // Check authentication status
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('🔐 Authentication check failed:', authError);
        return { 
          connected: true, 
          authenticated: false, 
          error: 'Authentication failed',
          details: authError
        };
      }

      if (!session || !session.user) {
        console.warn('🔐 No active session found');
        return { 
          connected: true, 
          authenticated: false, 
          error: 'No active session - please sign in again'
        };
      }

      // Test database connectivity with a simple query
      const { data: testData, error: dbError } = await supabase
        .from('scripts')
        .select('id')
        .limit(1);

      if (dbError) {
        console.error('💾 Database connection failed:', dbError);
        return { 
          connected: false, 
          authenticated: true, 
          error: 'Database connection failed',
          details: dbError
        };
      }

      console.log('✅ Supabase connection and authentication verified');
      return { connected: true, authenticated: true };

    } catch (error) {
      console.error('❌ Connection check failed:', error);
      return { 
        connected: false, 
        authenticated: false, 
        error: 'Connection check failed',
        details: error
      };
    }
  };
  
  const loadScripts = async () => {
    setIsLoading(true);
    setError(null);
    setConnectionStatus('checking');
    
    try {
      console.log('📚 Starting script library loading process...');
      
      // First, check connection and authentication
      const connectionCheck = await checkSupabaseConnection();
      
      if (!connectionCheck.connected) {
        setConnectionStatus('disconnected');
        throw new Error(`Connection failed: ${connectionCheck.error || 'Unknown connection error'}`);
      }
      
      if (!connectionCheck.authenticated) {
        setConnectionStatus('unauthenticated');
        throw new Error(`Authentication failed: ${connectionCheck.error || 'Please sign in again'}`);
      }
      
      setConnectionStatus('authenticated');
      console.log('✅ Connection and authentication verified, loading scripts...');
      
      // Load scripts and stats with enhanced error handling
      const [scriptsData, statsData] = await Promise.all([
        supabaseScriptService.getAllScripts().catch(error => {
          console.error('❌ Failed to load scripts:', error);
          throw new Error(`Scripts loading failed: ${error.message || 'Unknown error'}`);
        }),
        supabaseScriptService.getCacheStats().catch(error => {
          console.error('❌ Failed to load stats:', error);
          // Don't fail completely if stats fail - just log and continue
          console.warn('⚠️ Stats loading failed, using defaults');
          return {
            scriptCount: 0,
            chunkedScripts: 0,
            singleScenes: 0,
            encryptedScripts: 0,
            totalStorageUsed: 0,
            oldestScriptDate: null
          };
        })
      ]);
      
      setScripts(scriptsData);
      setCacheStats({
        scriptCount: statsData.scriptCount,
        chunkedScripts: statsData.chunkedScripts,
        singleScenes: statsData.singleScenes,
        encryptedScripts: statsData.encryptedScripts,
        totalSizeMB: statsData.totalStorageUsed / (1024 * 1024), // Convert to MB
        oldestScriptDate: statsData.oldestScriptDate
      });
      
      setConnectionStatus('connected');
      
      console.log('✅ Scripts loaded successfully from Supabase:', {
        count: scriptsData.length,
        chunked: statsData.chunkedScripts,
        single: statsData.singleScenes,
        encrypted: statsData.encryptedScripts
      });
      
    } catch (error: any) {
      console.error('❌ Failed to load scripts from Supabase:', error);
      
      // Enhanced error handling with specific error types
      let errorMessage = 'Failed to load scripts';
      let errorDetails = '';
      
      if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network Connection Failed';
        errorDetails = 'Check your internet connection and try again. If the problem persists, Supabase may be temporarily unavailable.';
      } else if (error.message?.includes('Authentication')) {
        errorMessage = 'Authentication Error';
        errorDetails = 'Please sign out and sign back in to refresh your session.';
      } else if (error.message?.includes('Database')) {
        errorMessage = 'Database Connection Error';
        errorDetails = 'Unable to connect to the database. Please try again later.';
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Rate Limit Exceeded';
        errorDetails = 'Too many requests. Please wait a moment and try again.';
      } else {
        errorMessage = error.message || 'Unknown error occurred';
        errorDetails = 'Please try refreshing the page or contact support if the issue persists.';
      }
      
      setError(`${errorMessage}: ${errorDetails}`);
      setConnectionStatus('disconnected');
      
      // Log additional debugging information
      console.group('🔍 Error Debugging Information');
      console.log('Error type:', typeof error);
      console.log('Error message:', error.message);
      console.log('Error stack:', error.stack);
      console.log('Connection status:', connectionStatus);
      console.log('Supabase URL configured:', !!import.meta.env.VITE_SUPABASE_URL);
      console.log('Supabase Key configured:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      console.groupEnd();
      
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteScript = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering row click
    
    if (!confirm('Are you sure you want to delete this script? This action cannot be undone.')) {
      return;
    }
    
    try {
      await supabaseScriptService.deleteScript(id);
      // Refresh the script list
      loadScripts();
    } catch (error: any) {
      console.error('Failed to delete script:', error);
      setError(`Failed to delete script: ${error.message || 'Unknown error'}`);
    }
  };
  
  const handleCleanupCache = async () => {
    try {
      const cleanup = await supabaseScriptService.cleanupCache();
      
      // Show cleanup message with safe number formatting
      const deletedCount = cleanup?.deletedOld || 0;
      const freedSpace = cleanup?.freedSpace || 0;
      setCleanupMessage(
        `Cleaned up ${deletedCount} old scripts and freed ${freedSpace.toFixed(2)}MB of space.`
      );
      
      // Hide message after 5 seconds
      setTimeout(() => setCleanupMessage(null), 5000);
      
      // Refresh the script list and stats
      loadScripts();
    } catch (error: any) {
      console.error('Failed to clean up cache:', error);
      setCleanupMessage(`Cache cleanup failed: ${error.message || 'Please try again.'}`);
      setTimeout(() => setCleanupMessage(null), 5000);
    }
  };

  const handleMigrateToEncryption = async () => {
    if (!confirm('This will encrypt all your existing scripts. This process cannot be undone. Continue?')) {
      return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      console.log('🔄 Starting encryption migration...');
      const result = await supabaseScriptService.migrateExistingScriptsToEncryption();
      setMigrationResult(result);
      
      // Refresh the script list to show updated encryption status
      await loadScripts();
      
      // Hide migration result after 10 seconds
      setTimeout(() => setMigrationResult(null), 10000);
    } catch (error: any) {
      console.error('❌ Migration failed:', error);
      setError(`Migration failed: ${error.message || 'Please try again.'}`);
    } finally {
      setIsMigrating(false);
    }
  };

  // Enhanced retry with connection check
  const handleRetry = async () => {
    console.log('🔄 User initiated retry...');
    await loadScripts();
  };

  // Manual connection test
  const handleTestConnection = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const connectionCheck = await checkSupabaseConnection();
      
      if (connectionCheck.connected && connectionCheck.authenticated) {
        setError(null);
        setCleanupMessage('✅ Connection test successful! Supabase is working properly.');
        setTimeout(() => setCleanupMessage(null), 3000);
      } else {
        setError(`Connection test failed: ${connectionCheck.error || 'Unknown issue'}`);
      }
    } catch (error: any) {
      setError(`Connection test failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  const formatFileSize = (bytes: number) => {
    // Add safety check for undefined/null bytes
    if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
      return '0 B';
    }
    
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Safe number formatting helper
  const safeToFixed = (value: number | undefined | null, decimals: number = 2): string => {
    if (typeof value !== 'number' || isNaN(value)) {
      return '0.' + '0'.repeat(decimals);
    }
    return value.toFixed(decimals);
  };

  // Check if there are unencrypted scripts
  const hasUnencryptedScripts = scripts.some(script => !script.is_encrypted);

  // Enhanced error display component
  const renderError = () => (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <div className="flex items-center gap-2">
            {connectionStatus === 'disconnected' ? (
              <WifiOff className="h-5 w-5 text-red-400" />
            ) : connectionStatus === 'unauthenticated' ? (
              <Shield className="h-5 w-5 text-yellow-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-400" />
            )}
            Script Library - Connection Issue
          </div>
        </h3>
        
        <div className="flex gap-2">
          <button
            onClick={handleTestConnection}
            disabled={isLoading}
            className="flex items-center gap-1 text-sm px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded"
          >
            <Wifi className="h-4 w-4" />
            Test Connection
          </button>
          
          <button
            onClick={handleRetry}
            disabled={isLoading}
            className="flex items-center gap-1 text-sm px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Connecting...' : 'Retry'}
          </button>
        </div>
      </div>
      
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium mb-2">Connection Failed</p>
            <p className="text-red-300 text-sm mb-3">{error}</p>
            
            <div className="text-slate-400 text-xs space-y-1">
              <p><strong>Troubleshooting steps:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Check your internet connection</li>
                <li>Try refreshing the page</li>
                <li>Sign out and sign back in if authentication failed</li>
                <li>Contact support if the problem persists</li>
              </ul>
            </div>
            
            <div className="mt-3 p-2 bg-slate-700/50 rounded text-xs">
              <p><strong>Connection Status:</strong> {connectionStatus}</p>
              <p><strong>Supabase URL:</strong> {import.meta.env.VITE_SUPABASE_URL ? '✅ Configured' : '❌ Missing'}</p>
              <p><strong>Supabase Key:</strong> {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Configured' : '❌ Missing'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (error) {
    return renderError();
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-yellow-400" />
            Your Script Library
            {connectionStatus === 'connected' && (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                Connected
              </div>
            )}
          </div>
        </h3>
        
        <div className="flex gap-2">
          <button
            onClick={loadScripts}
            disabled={isLoading}
            className="flex items-center gap-1 text-sm px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          
          <button
            onClick={handleCleanupCache}
            disabled={isLoading}
            className="flex items-center gap-1 text-sm px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50"
          >
            <HardDrive className="h-4 w-4" />
            Clean Cache
          </button>

          {hasUnencryptedScripts && (
            <button
              onClick={handleMigrateToEncryption}
              disabled={isMigrating || isLoading}
              className="flex items-center gap-1 text-sm px-3 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded"
            >
              <Key className="h-4 w-4" />
              {isMigrating ? 'Encrypting...' : 'Encrypt All'}
            </button>
          )}
        </div>
      </div>
      
      {/* Cache stats with encryption info */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 text-sm bg-slate-700/50 p-3 rounded">
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <div className="font-medium text-white">{cacheStats.scriptCount}</div>
          <div className="text-xs text-slate-400">Total Scripts</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Layers className="h-4 w-4 text-blue-400" />
          </div>
          <div className="font-medium text-white">{cacheStats.chunkedScripts}</div>
          <div className="text-xs text-slate-400">Chunked</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <BookOpen className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="font-medium text-white">{cacheStats.singleScenes}</div>
          <div className="text-xs text-slate-400">Single Scenes</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <ShieldCheck className="h-4 w-4 text-green-400" />
          </div>
          <div className="font-medium text-white">{cacheStats.encryptedScripts}</div>
          <div className="text-xs text-slate-400">Encrypted</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <HardDrive className="h-4 w-4 text-green-400" />
          </div>
          <div className="font-medium text-white">{safeToFixed(cacheStats.totalSizeMB)} MB</div>
          <div className="text-xs text-slate-400">Storage Used</div>
        </div>
      </div>
      
      {/* Migration result message */}
      {migrationResult && (
        <div className="mb-4 bg-green-500/10 border border-green-500/20 rounded p-3 text-sm text-green-300">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-medium">Encryption Migration Complete</span>
          </div>
          <p>
            Successfully encrypted {migrationResult.migrated} scripts.
            {migrationResult.failed > 0 && ` ${migrationResult.failed} scripts failed to migrate.`}
          </p>
        </div>
      )}
      
      {/* Cleanup message */}
      {cleanupMessage && (
        <div className="mb-4 bg-green-500/10 border border-green-500/20 rounded p-3 text-sm text-green-300">
          {cleanupMessage}
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400"></div>
            <div className="text-slate-400">
              {connectionStatus === 'checking' ? 'Checking connection...' :
               connectionStatus === 'authenticated' ? 'Loading scripts...' :
               'Connecting to Supabase...'}
            </div>
          </div>
        </div>
      ) : scripts.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-slate-500" />
          <p>No saved scripts yet.</p>
          <p className="text-sm mt-2">Upload a script to get started!</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-700">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Security
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Last Accessed
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800/30 divide-y divide-slate-700">
              {scripts.map((script) => (
                <tr 
                  key={script.id}
                  onClick={() => onScriptSelected(script.id)}
                  className="hover:bg-slate-700/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                    <div className="flex items-center gap-2">
                      {script.is_chunked ? (
                        <Layers className="h-4 w-4 text-blue-400" />
                      ) : (
                        <FileText className="h-4 w-4 text-yellow-400" />
                      )}
                      {script.title || 'Untitled Script'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                    {script.is_chunked ? (
                      <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs border border-blue-500/30">
                        Chunked ({script.chunks?.length || 0} sections)
                      </span>
                    ) : (
                      <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-xs border border-yellow-500/30">
                        Single Scene
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                    {script.is_encrypted ? (
                      <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs border border-green-500/30 flex items-center gap-1 w-fit">
                        <ShieldCheck className="h-3 w-3" />
                        Encrypted
                      </span>
                    ) : (
                      <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-full text-xs border border-red-500/30 flex items-center gap-1 w-fit">
                        <Shield className="h-3 w-3" />
                        Plain Text
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {formatDate(script.last_accessed)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                    {formatFileSize(script.file_size)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => handleDeleteScript(script.id, e)}
                      className="text-red-400 hover:text-red-300 p-1"
                      title="Delete script"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ScriptLibrary;