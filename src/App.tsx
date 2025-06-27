// src/App.tsx - Complete version preserving ALL existing functionality + comprehensive token integration + ROUTING
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';
import { supabaseScriptService } from './services/supabaseScriptService';
import Auth from './components/Auth';
import MentorSelection from './components/MentorSelection';
import ScriptUploader from './components/ScriptUploader';
import SceneEditor from './components/SceneEditor';
import FeedbackView from './components/FeedbackView';
import ChunkedFeedbackView from './components/ChunkedFeedbackView';
import RewriteSuggestions from './components/RewriteSuggestions';
import ScriptNavigationPanel from './components/ScriptNavigationPanel';
import ProgressiveProcessingProgress from './components/ProgressiveProcessingProgress';
// NEW: Token integration components and services
import { TokenDisplay, TokenValidationGuard, TokenCostPreview } from './components/TokenDisplay';
import { tokenService } from './services/tokenService';
import { aiFeedbackService } from './services/aiFeedbackService';
import { feedbackChunkService } from './services/feedbackChunkService';
import { writerAgentService } from './services/writerAgentService';
import { rewriteEvaluationService } from './services/rewriteEvaluationService';
import { TokenValidationMiddleware } from './utils/tokenValidationMiddleware';
// NEW: Routing imports for pricing and subscription management
import PricingPage from './components/PricingPage';
import SubscriptionManagement from './components/SubscriptionManagement';
import UpgradePrompt, { 
  LowTokensPrompt, 
  InsufficientTokensPrompt, 
  PremiumFeaturePrompt 
} from './components/UpgradePrompt';
import { mentors } from './data/mentors';

// NEW: Navigation Header Component
const NavigationHeader: React.FC<{
  session: any;
  userTokens: any;
  onSignOut: () => void;
}> = ({ session, userTokens, onSignOut }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActivePage = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SM</span>
              </div>
              <span className="text-white font-semibold text-lg">Script Mentor</span>
            </button>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-6">
              <button
                onClick={() => navigate('/')}
                className={`text-sm font-medium transition-colors ${
                  isActivePage('/') 
                    ? 'text-blue-400' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Mentor
              </button>
              
              <button
                onClick={() => navigate('/pricing')}
                className={`text-sm font-medium transition-colors ${
                  isActivePage('/pricing') 
                    ? 'text-blue-400' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Pricing
              </button>

              {session?.user && (
                <button
                  onClick={() => navigate('/subscription')}
                  className={`text-sm font-medium transition-colors ${
                    isActivePage('/subscription') 
                      ? 'text-blue-400' 
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Subscription
                </button>
              )}
            </nav>
          </div>

          {/* User Section */}
          <div className="flex items-center gap-4">
            {session?.user ? (
              <>
                {/* Token Display */}
                {userTokens && (
                  <div className="hidden sm:flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
                    <Coins className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-medium text-white">
                      {userTokens.balance}
                    </span>
                    <span className="text-xs text-slate-400">tokens</span>
                  </div>
                )}

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={onSignOut}
                    className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                  >
                    <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {session.user.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-slate-300 text-sm">
                Sign in to get started
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

import { 
  ScriptScene, 
  Feedback, 
  MentorWeights, 
  ScriptRewrite,
  FeedbackMode,
  FullScript,
  ScriptChunk,
  // NEW: Token types
  UserTokens,
  TokenValidationResult,
  TOKEN_COSTS,
  WriterSuggestionsResponse
} from './types';
import { CharacterMemoryManager } from './utils/characterMemory';
import { FeedbackGenerator } from './utils/feedbackGenerator';
import { ScriptChunker } from './utils/scriptChunker';
import { ProcessingProgress as ProgressiveProgressType, progressiveFeedbackService } from './services/progressiveFeedbackService';
import { backendApiService } from './services/backendApiService';
import { CharacterDataNormalizer } from './utils/characterDataNormalizer';
import { BookOpenCheck, Files, Activity, BookText, BookOpen, BookMarked, BarChart3, Sparkles, ArrowDown, LogOut, Layers, FileText, RefreshCw, AlertCircle, Coins, Crown, Zap, TrendingUp, CheckCircle, ChevronDown } from 'lucide-react';
import { processSceneText } from './utils/scriptFormatter';
import ScriptLibrary from './components/ScriptLibrary';
import FeedbackLibrary from './components/FeedbackLibrary'; // NEW: Add FeedbackLibrary component
import RewriteEvaluation from './components/RewriteEvaluation';
import { enhancedScriptRewriter } from './utils/enhancedScriptRewriter';
import { feedbackLibraryService } from './services/feedbackLibraryService'; // NEW: Add feedback library service
// NEW: Token integration hook
import { useTokens } from './hooks/useTokens';

// PRESERVED: Fixed LibraryButton component - moved outside App component to prevent recreation
const LibraryButton: React.FC<{
  showLibrary: boolean;
  onToggle: () => void;
}> = React.memo(({ showLibrary, onToggle }) => (
  <button
    onClick={onToggle}
    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 ease-in-out transform text-white library-button ${
      showLibrary
        ? 'bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95'
        : 'bg-slate-700 hover:bg-slate-600 hover:scale-105 active:scale-95'
    }`}
    type="button"
  >
    {showLibrary ? <BookMarked className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
    <span className="font-medium">{showLibrary ? 'Hide Library' : 'Script Library'}</span>
  </button>
));

// NEW: Main App Content Component (preserves all existing app logic)
const AppContent: React.FC = () => {
  // PRESERVED: All existing core state
  const [session, setSession] = useState<any>(null);
  const [selectedMentorId, setSelectedMentorId] = useState<string>('tony-gilroy');
  
  // PRESERVED: Script state - now supports both single scenes and full scripts
  const [currentScript, setCurrentScript] = useState<FullScript | null>(null);
  const [currentScene, setCurrentScene] = useState<ScriptScene | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  
  // PRESERVED: All feedback and processing state
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rewrite, setRewrite] = useState<ScriptRewrite | null>(null);
  const [diffLines, setDiffLines] = useState<string[]>([]);
  const [rewriteEvaluation, setRewriteEvaluation] = useState<any>(null);
  const [characters, setCharacters] = useState<Record<string, { name: string, notes: string[] }>>({});
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('structured');
  
  // PRESERVED: SIMPLIFIED LOADING STATES - Removed multiple progress state variables
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [isGeneratingWriterSuggestions, setIsGeneratingWriterSuggestions] = useState(false);
  const [writerSuggestionsReady, setWriterSuggestionsReady] = useState(false);
  const [showWriterSuggestions, setShowWriterSuggestions] = useState(false);
  const [writerSuggestionsStarted, setWriterSuggestionsStarted] = useState(false);
  
  // PRESERVED: UNIFIED PROGRESSIVE PROCESSING STATE - Single state for ALL feedback types
  const [progressiveProgress, setProgressiveProgress] = useState<ProgressiveProgressType | null>(null);
  const [showProgressiveProgress, setShowProgressiveProgress] = useState(false);
  const [partialFeedback, setPartialFeedback] = useState<Feedback | null>(null);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  
  // PRESERVED: Library state - Fixed with proper state management
  const [showLibrary, setShowLibrary] = useState(false);
  const [showFeedbackLibrary, setShowFeedbackLibrary] = useState(false); // NEW: Add feedback library state
  
  // NEW: Enhanced token integration with useTokens hook
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const [writerSuggestions, setWriterSuggestions] = useState<any | null>(null);
  const [rewriteAnalysis, setRewriteAnalysis] = useState<any>(null);

  // NEW: Integrated token management via useTokens hook Re-enabled - infinite loop fixed!
  const {
    userTokens,
    loading: tokenLoading,
    error: tokenError,
    balance,
    tier,
    monthlyAllowance,
    usageThisMonth,
    daysUntilReset,
    balanceStatus,
    refreshTokens,
    validateAction,
    canAffordAction
  } = useTokens({
    userId: session?.user?.id || '',
    autoRefresh: true,  // ← Re-enabled - infinite loop fixed!
    refreshInterval: 30000, // 30 seconds when we re-enable
    onBalanceChange: (newBalance, oldBalance) => {
      if (newBalance !== oldBalance) {
        console.log(`💰 Token balance updated: ${oldBalance} → ${newBalance}`);
      }
    },
    onCriticalBalance: (balance) => {
      console.warn(`⚠️ Critical token balance: ${balance} tokens remaining`);
    }
  });
  
  // PRESERVED: Ref to track if database test has been run
  const databaseTestRun = useRef(false);
  
  // PRESERVED: Character and feedback managers
  const characterManager = new CharacterMemoryManager(characters);
  const feedbackGenerator = new FeedbackGenerator(characterManager);

  // PRESERVED: Fixed useEffect to prevent infinite loop
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []); // Empty dependency array - only run once

  // PRESERVED: Separate effect for database testing - only run once when user is authenticated
  useEffect(() => {
    const testDatabase = async () => {
      if (databaseTestRun.current) return; // Prevent multiple runs
      
      try {
        console.log('Testing Supabase connection...');
        databaseTestRun.current = true; // Mark as run
        const stats = await supabaseScriptService.getCacheStats();
        console.log('Supabase connection successful:', stats);
      } catch (error) {
        console.error('Error connecting to Supabase:', error);
        databaseTestRun.current = false; // Reset on error so it can be retried
      }
    };
    
    if (session && !databaseTestRun.current) {
      testDatabase();
    }
  }, [session?.user?.id]); // Only depend on user ID, not the entire session object

  // PRESERVED: Cleanup effect to handle component unmount ONLY
  useEffect(() => {
    return () => {
      // Only cancel when component actually unmounts, not on every re-render
      if (progressiveFeedbackService.isCurrentlyProcessing()) {
        console.log('🧹 Component unmounting - cleaning up processing');
        progressiveFeedbackService.cancelProcessing();
        backendApiService.cancelAllRequests();
      }
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // NEW: Token state is now managed by useTokens hook automatically
  // Only need cleanup effect for token error state when user changes
  useEffect(() => {
    // Clear any lingering token errors when user changes
    if (!session?.user) {
      // Token state is automatically cleared by useTokens hook
      console.log('🔄 User signed out - token state cleared by useTokens hook');
    }
  }, [session?.user?.id]);


  // NEW: Enhanced token error handling using useTokens hook data
  const handleTokenError = (error: string, actionType: string) => {
    console.error(`❌ Token error for ${actionType}:`, error);

    if (error.includes('Insufficient tokens')) {
      const cost = tokenService.getTokenCost(actionType as any);
      console.log(`💰 Insufficient tokens for ${actionType}. Need ${cost}, have ${balance}. Consider upgrading.`);
    }
  };

  // NEW: Enhanced token validation before actions
  const validateTokensBeforeAction = async (actionType: string): Promise<boolean> => {
    if (!session?.user?.id) {
      console.warn('⚠️ No user session for token validation');
      return false;
    }

    try {
      const validation = await validateAction(actionType as any);
      if (!validation.hasEnoughTokens) {
        handleTokenError(
          `Insufficient tokens for ${actionType}. Need ${validation.requiredTokens}, have ${validation.currentBalance}`,
          actionType
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      handleTokenError('Failed to validate tokens', actionType);
      return false;
    }
  };

  // PRESERVED: Sign out handler with token cleanup
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    databaseTestRun.current = false; // Reset database test flag
    // NEW: Clear token state
    setUserTokens(null);
    setTokenError(null);
    setWriterSuggestions(null);
    setRewriteAnalysis(null);
  };

// SIMPLIFIED: Direct toggle handlers that allow seamless switching
const handleToggleLibrary = useCallback(() => {
  console.log('📚 Toggling script library');
  setShowLibrary(prev => {
    const newState = !prev;
    console.log('📚 New script library state:', newState);
    
    // If opening script library, automatically close feedback library
    if (newState) {
      setShowFeedbackLibrary(false);
    }
    
    return newState;
  });
}, []); // Remove dependencies for cleaner logic

const handleToggleFeedbackLibrary = useCallback(() => {
  console.log('📚 Toggling feedback library');
  setShowFeedbackLibrary(prev => {
    const newState = !prev;
    console.log('📚 New feedback library state:', newState);
    
    // If opening feedback library, automatically close script library
    if (newState) {
      setShowLibrary(false);
    }
    
    return newState;
  });
}, []); // Remove dependencies for cleaner logic

  // PRESERVED: ENHANCED CANCEL FUNCTION - Properly stops backend processing
  const handleCancelProcessing = async () => {
    console.log('🛑 User initiated cancel - stopping all processing...');

  try {
    // 1. Cancel the progressive feedback service
    if (progressiveFeedbackService.isCurrentlyProcessing()) {
      console.log('🛑 Cancelling progressive feedback service...');
      progressiveFeedbackService.cancelProcessing();
    }

    // 2. Abort current abort controller if exists
    if (currentAbortController) {
      console.log('🛑 Aborting current controller...');
      currentAbortController.abort();
      
      // ✅ FIX: Wait briefly for abort signal to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 3. Cancel all backend API requests with confirmation
    const activeRequestCount = backendApiService.getActiveRequestCount();
    if (activeRequestCount > 0) {
      console.log(`🛑 Cancelling ${activeRequestCount} active backend requests...`);
      backendApiService.cancelAllRequests();
      
      // ✅ FIX: Wait for requests to actually cancel
      let attempts = 0;
      while (backendApiService.getActiveRequestCount() > 0 && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (backendApiService.getActiveRequestCount() > 0) {
        console.warn('⚠️ Some backend requests may still be active after cancellation');
      } else {
        console.log('✅ All backend requests successfully cancelled');
      }
    }

    // 4. Reset all UI state AFTER confirming backend cancellation
    setShowProgressiveProgress(false);
    setIsGeneratingFeedback(false);
    setProgressiveProgress(null);
    setPartialFeedback(null);
    setCurrentAbortController(null);

    // 5. Reset writer suggestions state
    setIsGeneratingWriterSuggestions(false);
    setWriterSuggestionsStarted(false);
    setWriterSuggestionsReady(false);
    setShowWriterSuggestions(false);

    // 6. Clear any partial feedback that might have been generated
    // Note: Keep existing full feedback if it was already complete
    if (partialFeedback && !feedback) {
      setPartialFeedback(null);
    }

    console.log('✅ Processing cancellation completed successfully');

  } catch (error) {
    console.error('❌ Error during cancellation:', error);

    // ✅ FIX: Even if there's an error, force reset the UI state
    setShowProgressiveProgress(false);
    setIsGeneratingFeedback(false);
    setProgressiveProgress(null);
    setPartialFeedback(null);
    setCurrentAbortController(null);
  }
};

  if (!session) {
    return <Auth onAuthChange={setSession} />;
  }

  // PRESERVED: Helper function to get page-based title for chunked scripts
  const getChunkDisplayTitle = (chunkId: string | null): string => {
    if (!currentScript || !chunkId) return '';
    
    const chunk = currentScript.chunks.find(c => c.id === chunkId);
    if (!chunk) return '';
    
    const chunkIndex = currentScript.chunks.findIndex(c => c.id === chunkId);
    
    // Use actual page numbers if available
    if (chunk.startPage && chunk.endPage) {
      return `Pages ${chunk.startPage}-${chunk.endPage}`;
    }
    
    // Fallback: estimate pages based on position
    const avgPagesPerChunk = 15;
    const startPage = (chunkIndex * avgPagesPerChunk) + 1;
    const endPage = startPage + avgPagesPerChunk - 1;
    return `Pages ${startPage}-${endPage}`;
  };

  // NEW: Helper function to get current page range for library saving
  const getCurrentPageRange = (): string => {
    if (!currentScript) return 'Unknown Pages';
    
    if (isChunkedScript && selectedChunkId && currentScript.chunks) {
      const chunk = currentScript.chunks.find(c => c.id === selectedChunkId);
      if (chunk && chunk.startPage && chunk.endPage) {
        return `Pages ${chunk.startPage}-${chunk.endPage}`;
      }
    }
    
    // For full script or unknown ranges
    if (currentScript.totalPages) {
      return `Pages 1-${currentScript.totalPages}`;
    }
    
    return 'Full Script';
  };

  // ENHANCED: Complete script selection handler with comprehensive state reset
  const handleScriptSelected = async (scriptId: string) => {
    try {
      setIsLoadingScript(true);

      // Close both libraries immediately when script is selected
      console.log('📖 Script selected, closing all libraries');
      setShowLibrary(false);
      setShowFeedbackLibrary(false);

      // ENHANCED: Comprehensive state reset before loading new script
      console.log('🔄 Clearing ALL previous script state for library selection');
      setFeedback(null);
      setPartialFeedback(null); // Clear partial feedback too
      setRewrite(null);
      setDiffLines([]);
      setRewriteEvaluation(null);
      setWriterSuggestionsReady(false);
      setShowWriterSuggestions(false);
      setWriterSuggestionsStarted(false);
      setWriterSuggestions(null); // Clear writer suggestions
      setRewriteAnalysis(null); // Clear rewrite analysis
      setTokenError(null); // Clear any token errors

      // Cancel any ongoing processing
      if (currentAbortController) {
        console.log('🛑 Cancelling ongoing processing for script switch');
        currentAbortController.abort();
        setCurrentAbortController(null);
      }
      setIsGeneratingFeedback(false);
      setShowProgressiveProgress(false);
      setProgressiveProgress(null);
      
      console.log('📖 Loading script from Supabase:', scriptId);
      const script = await supabaseScriptService.getScript(scriptId);
      
      if (script) {
        // Normalize character data from cached script to prevent type errors
        const normalizedCharacters = CharacterDataNormalizer.normalizeCharacters(script.characters || {});
        console.log('🔧 Normalized cached script characters:', normalizedCharacters);
        
        // Check if this is a chunked script
        if (script.is_chunked && script.chunks && script.chunks.length > 1) {
          // This is a full script with chunks - reconstruct FullScript object
          const fullScript: FullScript = {
            id: script.id,
            title: script.title,
            originalContent: script.content,
            processedContent: script.processed_content,
            chunks: script.chunks,
            characters: normalizedCharacters,
            totalPages: script.total_pages || 0,
            chunkingStrategy: script.chunking_strategy || 'pages'
          };
          
          setCurrentScript(fullScript);
          setCurrentScene(null);
          setSelectedChunkId(fullScript.chunks[0]?.id || null);
        } else {
          // This is a single scene
          const scene = {
            id: script.id,
            title: script.title,
            content: script.processed_content,
            characters: Object.keys(normalizedCharacters)
          };
          setCurrentScene(scene);
          setCurrentScript(null);
          setSelectedChunkId(null);
        }
        
        setCharacters(normalizedCharacters);
        
        if (script.feedback) {
          setFeedback(script.feedback);
          setWriterSuggestionsReady(false);
          setShowWriterSuggestions(false);
          setWriterSuggestionsStarted(false);
        }
        
        if (script.rewrite) {
          setRewrite(script.rewrite);
          if (script.diff_lines) {
            setDiffLines(script.diff_lines);
          }
        } else {
          setRewrite(null);
          setDiffLines([]);
        }
        
        console.log('✅ Script loaded successfully from Supabase');
      }
    } catch (error) {
      console.error('Error loading script from Supabase:', error);
    } finally {
      setIsLoadingScript(false);
    }
  };

  // ENHANCED: Complete feedback generation with token integration + ALL original cancellation support
  const handleSelectMentor = async (mentor: { id: string }, mode: FeedbackMode = feedbackMode) => {
    console.log('🎬 Starting feedback generation with token validation + cancellation support...', {
      mentor: mentor.id,
      hasScript: !!currentScript,
      hasScene: !!currentScene,
      userId: session?.user?.id
    });

    setSelectedMentorId(mentor.id);
    setFeedbackMode(mode);

    const selectedMentor = mentors.find(m => m.id === mentor.id);
    if (!selectedMentor) return;

    // Reset all feedback-related state
    setWriterSuggestionsReady(false);
    setShowWriterSuggestions(false);
    setWriterSuggestionsStarted(false);
    setPartialFeedback(null);
    setFeedback(null);
    setTokenError(null);

    // Create new abort controller for this operation
    const abortController = new AbortController();
    setCurrentAbortController(abortController);

    // Set up processing state
    setIsGeneratingFeedback(true);
    setShowProgressiveProgress(true);

    try {
      if (currentScript && currentScript.chunks.length > 1) {
        // Handle chunked script feedback with token integration
        await handleChunkedFeedback(currentScript, selectedMentor, abortController);
      } else if (currentScene) {
        // Handle single scene feedback with token integration
        await handleSingleSceneFeedback(currentScene, selectedMentor, abortController);
      }
    } catch (error: any) {
      if (error.message?.includes('cancelled') || error.message?.includes('aborted')) {
        console.log('✅ Feedback generation was cancelled by user');
        // State is already reset by handleCancelProcessing
        return;
      } else {
        console.error('❌ Feedback generation failed:', error);
        // Handle other errors appropriately
        setFeedback(null);
        setPartialFeedback(null);
      }
    } finally {
      // Clean up only if not cancelled (cancelled state is handled by handleCancelProcessing)
      // NOTE: Don't clean up showProgressiveProgress here - let onComplete handle it
      if (!abortController.signal.aborted) {
        setCurrentAbortController(null);
        // setIsGeneratingFeedback and setShowProgressiveProgress will be handled by onComplete
      }
    }
  };

  // ENHANCED: Chunked feedback with complete token integration + ALL original progressive processing
  const handleChunkedFeedback = async (
    script: FullScript, 
    mentor: any, 
    abortController: AbortController
  ) => {
    setIsGeneratingFeedback(true);
    setShowProgressiveProgress(true);
    setPartialFeedback(null);
    
    try {
      console.log('🚀 Starting token-aware progressive chunked feedback generation...', {
        mentor: mentor.name,
        chunkCount: script.chunks.length,
        strategy: script.chunkingStrategy,
        userId: session?.user?.id
      });

      // NEW: Enhanced token validation and processing with useTokens integration
      if (session?.user) {
        // Pre-validate tokens using useTokens hook
        const canProceed = await validateTokensBeforeAction('chunked_feedback');
        if (!canProceed) {
          console.log('❌ Token validation failed for chunked feedback');
          return;
        }

        console.log('✅ Token validation passed, proceeding with chunked feedback');
        // Use token-aware service
        const result = await feedbackChunkService.generateChunkedFeedback({
          userId: session.user.id,
          chunks: script.chunks,
          mentor: mentor,
          characters: characters,
          actionType: 'chunked_feedback',
          scriptId: script.id,
          onProgress: (progress) => {
            setProgressiveProgress(progress);

            // FIXED: Added defensive null checks for completedChunks
            const completedChunks = progress.completedChunks || [];

            // Show partial results as chunks complete
            if (completedChunks.length > 0 && !partialFeedback) {
              const partialResult = {
                id: `partial-feedback-${Date.now()}`,
                mentorId: mentor.id,
                sceneId: script.id,
                timestamp: new Date(),
                isChunked: true,
                chunks: progress.completedChunks,
                summary: {
                  overallStructure: `Processing ${progress.currentChunk}/${progress.totalChunks} sections...`,
                  keyStrengths: ['Progressive analysis in progress'],
                  majorIssues: progress.failedChunks.length > 0 
                    ? [`${progress.failedChunks.length} sections encountered issues`]
                    : [],
                  globalRecommendations: ['Review will be complete when all sections finish processing']
                }
              } as any;
              
              setPartialFeedback(partialResult);
            }
          },
          abortSignal: abortController.signal
        });

        // ✅ Check if operation was cancelled before setting results
        if (!abortController.signal.aborted) {
          if (result.success) {
            const finalFeedback = {
              id: result.feedback.id,
              mentorId: mentor.id,
              sceneId: script.id,
              timestamp: result.feedback.timestamp,
              isChunked: true,
              chunks: result.feedback.chunks,
              summary: result.feedback.summary,
              processingStats: (result.feedback as any).processingStats
            } as any;

            setFeedback(finalFeedback);
            setPartialFeedback(null);
            setRewrite(null);
            setDiffLines([]);
            // Token balance automatically refreshed by useTokens hook
            console.log('✅ Chunked feedback complete, tokens automatically refreshed');

            console.log('✅ Token-aware progressive chunked feedback complete');

            // ENHANCED AUTO-SAVE: Better error handling and timing validation
            try {
              // STEP 1: Enhanced UUID validation with timing context
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
              const isValidUUID = script.id && uuidRegex.test(script.id);

              if (!isValidUUID) {
                // ENHANCED: Check if this is a timing issue with new uploads
                if (script.id && script.id.startsWith('script_')) {
                  console.warn('⚠️ Auto-save skipped: New script upload still using temporary ID, this is expected for new uploads:', script.id);
                  console.info('ℹ️ Script will be auto-saved after database sync completes');
                  return; // Skip gracefully for new uploads
                } else {
                  console.warn('⚠️ Auto-save failed: Script ID is not a valid UUID:', script.id);
                  throw new Error(`Invalid script ID format for auto-save: ${script.id}`);
                }
              }

              // STEP 2: Build effective context with validated ID
              const effectiveScriptId = script.id; // Use validated UUID
              const effectiveScriptTitle = script.title || 'Chunked Script Feedback';
              const effectivePages = script.totalPages
                ? `Pages 1-${script.totalPages}`
                : `${script.chunks.length} Sections`;

              console.log('📚 Auto-saving chunked feedback with validated UUID context:', {
                scriptUUID: effectiveScriptId,
                scriptTitle: effectiveScriptTitle,
                mentorId: mentor.id,
                feedbackId: finalFeedback.id,
                chunkCount: script.chunks.length,
                hasOriginalContent: !!script.originalContent
              });

              await feedbackLibraryService.saveFeedbackSessionToLibrary(
                effectiveScriptId,
                effectiveScriptTitle,
                [mentor.id],
                mentor.name,
                effectivePages,
                finalFeedback,
                script.originalContent
              );
              console.log('✅ Feedback session auto-saved to library with UUID');
            } catch (error) {
              // ENHANCED: More specific error handling
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';

              if (errorMessage.includes('temporary ID') || errorMessage.includes('script_')) {
                console.info('ℹ️ Auto-save gracefully skipped for new script upload - this is expected');
              } else {
                console.warn('⚠️ Auto-save failed (feedback generation continues normally):', errorMessage);
                console.warn('Auto-save diagnostic info:', {
                  scriptId: script.id,
                  scriptIdType: typeof script.id,
                  scriptIdLength: script.id?.length,
                  scriptTitle: script.title,
                  feedbackId: finalFeedback?.id,
                  mentorId: mentor.id,
                  isNewUpload: script.id?.startsWith('script_') ? 'yes' : 'no'
                });
              }
              // Never throw - auto-save failure shouldn't break feedback generation
            }

            // Start writer suggestions in background (with cancellation support)
            if (selectedChunkId) {
              const selectedChunk = script.chunks.find(c => c.id === selectedChunkId);
              const chunkFeedback = result.feedback.chunks.find(cf => cf.chunkId === selectedChunkId);

              if (selectedChunk && chunkFeedback && !(chunkFeedback as any).processingError) {
                setIsGeneratingWriterSuggestions(true);
                setWriterSuggestionsStarted(true);
                generateWriterSuggestionsInBackground(selectedChunk, finalFeedback, abortController);
              }
            }
          } else {
            handleTokenError(result.error || 'Chunked feedback generation failed', 'chunked_feedback');
          }
        } else {
          console.log('🛑 Chunked feedback was cancelled - not setting results');
        }
      } else {
        // PRESERVED: Fallback to original progressive processing without token integration
        const newFeedback = await progressiveFeedbackService.processChunksProgressively(
          script.chunks,
          mentor,
          characters,
          (progress) => {
            setProgressiveProgress(progress);

            // FIXED: Added defensive null checks for completedChunks
            const completedChunks = progress.completedChunks || [];

            // Show partial results as chunks complete
            if (completedChunks.length > 0 && !partialFeedback) {
              const partialResult = {
                id: `partial-feedback-${Date.now()}`,
                mentorId: mentor.id,
                sceneId: script.id,
                timestamp: new Date(),
                isChunked: true,
                chunks: progress.completedChunks,
                summary: {
                  overallStructure: `Processing ${progress.currentChunk}/${progress.totalChunks} sections...`,
                  keyStrengths: ['Progressive analysis in progress'],
                  majorIssues: progress.failedChunks.length > 0 
                    ? [`${progress.failedChunks.length} sections encountered issues`]
                    : [],
                  globalRecommendations: ['Review will be complete when all sections finish processing']
                }
              } as any;
              
              setPartialFeedback(partialResult);
            }
          },
          {
            maxConcurrent: 1,
            retryAttempts: 3,
            baseDelay: 3000,
            exponentialBackoff: true,
            showPartialResults: true,
            processingType: 'chunked',
            abortSignal: abortController.signal
          }
        );
        
        // Only set final feedback if not cancelled
        if (!abortController.signal.aborted) {
          const finalFeedback = {
            id: newFeedback.id,
            mentorId: mentor.id,
            sceneId: script.id,
            timestamp: newFeedback.timestamp,
            isChunked: true,
            chunks: newFeedback.chunks,
            summary: newFeedback.summary,
            processingStats: (newFeedback as any).processingStats
          } as any;
          
          setFeedback(finalFeedback);
          setPartialFeedback(null);
          setRewrite(null);
          setDiffLines([]);
          
          console.log('✅ Progressive chunked feedback complete');

          // ENHANCED AUTO-SAVE: Legacy path with UUID validation
          try {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            const isValidUUID = script.id && uuidRegex.test(script.id);

            if (isValidUUID) {
              await feedbackLibraryService.saveFeedbackSessionToLibrary(
                script.id,
                script.title || 'Chunked Script Feedback',
                [mentor.id],
                mentor.name,
                script.totalPages ? `Pages 1-${script.totalPages}` : `${script.chunks.length} Sections`,
                finalFeedback,
                script.originalContent
              );
              console.log('✅ Legacy chunked feedback auto-saved to library with UUID');
            } else {
              console.warn('⚠️ Legacy chunked feedback: Invalid UUID, skipping auto-save:', script.id);
            }
          } catch (error) {
            console.warn('⚠️ Legacy chunked feedback auto-save failed (non-critical):', error);
          }

          // Start writer suggestions in background (with cancellation support)
          if (!abortController.signal.aborted && selectedChunkId) {
            const selectedChunk = script.chunks.find(c => c.id === selectedChunkId);
            const chunkFeedback = newFeedback.chunks.find(cf => cf.chunkId === selectedChunkId);

            if (selectedChunk && chunkFeedback && !(chunkFeedback as any).processingError) {
              setIsGeneratingWriterSuggestions(true);
              setWriterSuggestionsStarted(true);
              generateWriterSuggestionsInBackground(selectedChunk, finalFeedback, abortController);
            }
          }
        }
      }
      
    } catch (error: any) {
      if (!abortController.signal.aborted) {
        console.error('❌ Progressive chunked feedback failed:', error);
        if (error.message?.includes('Insufficient tokens')) {
          handleTokenError(error.message, 'chunked_feedback');
        }
        setFeedback(null);
        setPartialFeedback(null);
      }
      throw error; // Re-throw to be handled by caller
    }
  };

  // ENHANCED: Single scene feedback with complete token integration + ALL original progressive processing
  const handleSingleSceneFeedback = async (
    scene: ScriptScene, 
    mentor: any, 
    abortController: AbortController
  ) => {
    setIsGeneratingFeedback(true);
    setShowProgressiveProgress(true);
    setPartialFeedback(null);
    
    try {
      console.log('🚀 Starting token-aware progressive single scene feedback...', {
        mentor: mentor.name,
        sceneLength: scene.content.length,
        userId: session?.user?.id
      });

      // NEW: Token validation and processing if user is authenticated
      // ✅ ALWAYS show initial progress regardless of path
setProgressiveProgress({
  currentChunk: 1,
  totalChunks: 1,
  chunkTitle: scene.title,
  progress: 10,
  message: `Starting ${mentor.name} analysis for scene...`,
  isRetrying: false,
  retryCount: 0,
  completedChunks: [],
  failedChunks: [],
  processingType: 'single'
});

      // Token validation and processing if user is authenticated
      if (session?.user) {
        // Pre-validate tokens using useTokens hook
        const canProceed = await validateTokensBeforeAction('single_feedback');
        if (!canProceed) {
          console.log('❌ Token validation failed for single scene feedback');
          return;
        }

        console.log('✅ Token validation passed, proceeding with single scene feedback');
        console.log('🔒 Using token-aware processing with progressive UI...');
  
  // ✅ Show progress during token validation
  setProgressiveProgress(prev => prev ? {
    ...prev,
    progress: 25,
    message: `Validating tokens for ${mentor.name} analysis...`
  } : null);

  // Use token-aware service
  const result = await aiFeedbackService.generateDualFeedback({
    userId: session.user.id,
    scene: scene,
    mentor: mentor,
    characters: characters,
    actionType: 'single_feedback',
    scriptId: scene.id,
    mentorId: mentor.id,
    sceneId: scene.id,
    abortSignal: abortController.signal
  });

  // ✅ Show progress during processing
  setProgressiveProgress(prev => prev ? {
    ...prev,
    progress: 75,
    message: `Processing ${mentor.name} feedback via backend API...`
  } : null);

  // ✅ Simulate brief processing time to show completion
  await new Promise(resolve => setTimeout(resolve, 500));

  if (result.success) {
    // ✅ Show completion progress
    setProgressiveProgress(prev => prev ? {
      ...prev,
      progress: 100,
      message: `${mentor.name} analysis complete!`,
      completedChunks: [{
        chunkId: scene.id,
        chunkTitle: scene.title,
        structuredContent: result.feedback.structuredContent || '',
        scratchpadContent: result.feedback.scratchpadContent || '',
        mentorId: mentor.id,
        timestamp: new Date(),
        categories: result.feedback.categories || {
          structure: 'Analyzed',
          dialogue: 'Analyzed', 
          pacing: 'Analyzed',
          theme: 'Analyzed'
        }
      }]
    } : null);

    // ✅ Check if operation was cancelled before setting results
    if (!abortController.signal.aborted) {
      setFeedback(result.feedback);
      setPartialFeedback(null);
      setRewrite(null);
      setDiffLines([]);
      // Token balance automatically refreshed by useTokens hook
      console.log('✅ Single scene feedback complete, tokens automatically refreshed');
      
      console.log('✅ Token-aware progressive single scene feedback complete');

      // ENHANCED AUTO-SAVE: Better error handling and timing validation
      try {
        // STEP 1: Enhanced UUID validation with timing context
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const isValidUUID = scene.id && uuidRegex.test(scene.id);

        if (!isValidUUID) {
          // ENHANCED: Check if this is a timing issue with new uploads
          if (scene.id && scene.id.startsWith('script_')) {
            console.warn('⚠️ Auto-save skipped: New scene upload still using temporary ID, this is expected for new uploads:', scene.id);
            console.info('ℹ️ Scene will be auto-saved after database sync completes');
            return; // Skip gracefully for new uploads
          } else {
            console.warn('⚠️ Auto-save failed: Scene ID is not a valid UUID:', scene.id);
            throw new Error(`Invalid scene ID format for auto-save: ${scene.id}`);
          }
        }

        // STEP 2: Build effective context with validated ID
        const effectiveScriptId = scene.id; // Use validated UUID
        const effectiveScriptTitle = scene.title || 'Single Scene Feedback';

        console.log('📚 Auto-saving single scene feedback with validated UUID context:', {
          sceneUUID: effectiveScriptId,
          sceneTitle: effectiveScriptTitle,
          mentorId: mentor.id,
          feedbackId: result.feedback.id,
          hasSceneContent: !!scene.content
        });

        await feedbackLibraryService.saveFeedbackSessionToLibrary(
          effectiveScriptId,
          effectiveScriptTitle,
          [mentor.id],
          mentor.name,
          'Single Scene',
          result.feedback,
          scene.content
        );
        console.log('✅ Single scene feedback auto-saved to library with UUID');
      } catch (error) {
        // ENHANCED: More specific error handling
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('temporary ID') || errorMessage.includes('script_')) {
          console.info('ℹ️ Auto-save gracefully skipped for new scene upload - this is expected');
        } else {
          console.warn('⚠️ Auto-save failed (feedback generation continues normally):', errorMessage);
          console.warn('Auto-save diagnostic info:', {
            sceneId: scene.id,
            sceneIdType: typeof scene.id,
            sceneIdLength: scene.id?.length,
            sceneTitle: scene.title,
            feedbackId: result.feedback?.id,
            mentorId: mentor.id,
            isNewUpload: scene.id?.startsWith('script_') ? 'yes' : 'no'
          });
        }
        // Never throw - auto-save failure shouldn't break feedback generation
      }

      // Start writer suggestions in background
      setIsGeneratingWriterSuggestions(true);
      setWriterSuggestionsStarted(true);
      generateWriterSuggestionsInBackground(scene, result.feedback, abortController);
    } else {
      console.log('🛑 Single scene feedback was cancelled - not setting results');
    }
  } else {
    handleTokenError(result.error || 'Single scene feedback generation failed', 'single_feedback');
  }
      } else {
        // PRESERVED: Fallback to original progressive processing without token integration
        // Convert single scene to chunk format for progressive processing
        const sceneAsChunk: ScriptChunk = {
          id: scene.id,
          title: scene.title,
          content: scene.content,
          characters: scene.characters,
          chunkType: 'scene',
          startPage: 1,
          endPage: 1
        };

        // Use progressive feedback service for consistency
        const newFeedback = await progressiveFeedbackService.processChunksProgressively(
          [sceneAsChunk],
          mentor,
          characters,
          (progress) => {
            setProgressiveProgress(progress);
            
            // Show partial results for single scene
            if (progress.completedChunks.length > 0 && !partialFeedback) {
              const partialResult = {
                id: `partial-feedback-${Date.now()}`,
                mentorId: mentor.id,
                sceneId: scene.id,
                timestamp: new Date(),
                isChunked: false,
                structuredContent: progress.completedChunks[0]?.structuredContent || '',
                scratchpadContent: progress.completedChunks[0]?.scratchpadContent || '',
                categories: progress.completedChunks[0]?.categories || {
                  structure: 'Analyzing...',
                  dialogue: 'Analyzing...',
                  pacing: 'Analyzing...',
                  theme: 'Analyzing...'
                }
              } as any;
              
              setPartialFeedback(partialResult);
            }
          },
          {
            maxConcurrent: 1,
            retryAttempts: 3,
            baseDelay: 2000,
            exponentialBackoff: true,
            showPartialResults: true,
            processingType: 'single',
            abortSignal: abortController.signal
          }
        );
        
        // Convert chunked feedback back to single scene feedback format
        // Only set final feedback if not cancelled
        if (!abortController.signal.aborted) {
          const chunkFeedback = newFeedback.chunks[0];
          const finalFeedback = {
            id: newFeedback.id,
            mentorId: mentor.id,
            sceneId: scene.id,
            timestamp: newFeedback.timestamp,
            isChunked: false,
            structuredContent: chunkFeedback?.structuredContent || '',
            scratchpadContent: chunkFeedback?.scratchpadContent || '',
            categories: chunkFeedback?.categories || {
              structure: 'Analyzed',
              dialogue: 'Analyzed',
              pacing: 'Analyzed',
              theme: 'Analyzed'
            }
          } as Feedback;
          
          setFeedback(finalFeedback);
          setPartialFeedback(null);
          setRewrite(null);
          setDiffLines([]);
          
          console.log('✅ Progressive single scene feedback complete');

          // ENHANCED AUTO-SAVE: Legacy path with UUID validation
          try {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            const isValidUUID = scene.id && uuidRegex.test(scene.id);

            if (isValidUUID) {
              await feedbackLibraryService.saveFeedbackSessionToLibrary(
                scene.id,
                scene.title || 'Single Scene Feedback',
                [mentor.id],
                mentor.name,
                'Single Scene',
                finalFeedback,
                scene.content
              );
              console.log('✅ Legacy single scene feedback auto-saved to library with UUID');
            } else {
              console.warn('⚠️ Legacy single scene feedback: Invalid UUID, skipping auto-save:', scene.id);
            }
          } catch (error) {
            console.warn('⚠️ Legacy single scene feedback auto-save failed (non-critical):', error);
          }

          // Start writer suggestions in background (with cancellation support)
          if (!abortController.signal.aborted) {
            setIsGeneratingWriterSuggestions(true);
            setWriterSuggestionsStarted(true);
            generateWriterSuggestionsInBackground(scene, finalFeedback, abortController);
          }
        }
      }
      
    } catch (error: any) {
      if (!abortController.signal.aborted) {
        console.error('❌ Progressive single scene feedback failed:', error);
        if (error.message?.includes('Insufficient tokens')) {
          handleTokenError(error.message, 'single_feedback');
        }
        setFeedback(null);
        setPartialFeedback(null);
      }
      throw error; // Re-throw to be handled by caller
    }
  };

  // PRESERVED: Complete enhanced writer suggestions with cancellation support + token awareness
  const generateWriterSuggestionsInBackground = async (
    scene: ScriptScene | ScriptChunk, 
    feedback: Feedback,
    abortController: AbortController
  ) => {
    try {
      console.log('🎨 Background: Preparing writer suggestions generation...', {
        sceneType: 'chunkType' in scene ? 'chunk' : 'scene',
        sceneTitle: scene.title,
        mentorId: feedback.mentorId,
        isBlended: feedback.mentorId === 'blended',
        userId: session?.user?.id
      });
      
      // Handle blended mentor case specially - THIS IS THE CRITICAL FIX
      let mentor;
      if (feedback.mentorId === 'blended') {
        // Create blended mentor object for background processing
        mentor = { 
          id: 'blended', 
          name: 'Blended Mentors', 
          tone: 'Multi-perspective approach',
          styleNotes: 'Combined insights from multiple mentors',
          avatar: 'https://images.pexels.com/photos/7102/notes-macbook-study-conference.jpg?auto=compress&cs=tinysrgb&w=600',
          accent: '#8b5cf6',
          mantra: 'Multiple perspectives reveal the full picture.',
          feedbackStyle: 'analytical' as const,
          priorities: ['multi-perspective-analysis'],
          analysisApproach: 'blended'
        };
        console.log('🎭 Using blended mentor for writer suggestions background processing');
      } else {
        // Find regular mentor
        mentor = mentors.find(m => m.id === feedback.mentorId);
        if (!mentor) {
          console.error('❌ Background: Mentor not found for ID:', feedback.mentorId);
          // CRITICAL: Reset state properly when mentor not found
          setIsGeneratingWriterSuggestions(false);
          setWriterSuggestionsStarted(false);
          return;
        }
      }
      
      const startTime = Date.now();
      // Reduce preparation time for better UX
      const preparationTime = Math.random() * 2000 + 1500; // 1.5-3.5 seconds
      
      console.log('⏰ Writer suggestions timeout scheduled for', preparationTime + 'ms');
      
      // Check for cancellation before starting
      if (abortController.signal.aborted) {
        console.log('🛑 Writer suggestions cancelled before starting');
        return;
      }

      // Use setTimeout with cancellation check
      setTimeout(() => {
        // Check for cancellation when timeout executes
        if (abortController.signal.aborted) {
          console.log('🛑 Writer suggestions cancelled during timeout');
          return;
        }

        const generationTime = Date.now() - startTime;
        
        console.log('✅ Background: Writer suggestions ready!', {
          preparationTime: `${generationTime}ms`,
          mentor: mentor.name,
          sceneType: 'chunkType' in scene ? 'chunk' : 'scene',
          isBlended: feedback.mentorId === 'blended'
        });
        
        console.log('🔄 Updating writer suggestions state...');
        setIsGeneratingWriterSuggestions(false);
        setWriterSuggestionsReady(true);
        console.log('✅ State updated: isGeneratingWriterSuggestions=false, writerSuggestionsReady=true');
        
      }, preparationTime);
      
    } catch (error) {
      console.error('❌ Background writer suggestions preparation failed:', error);
      // Ensure state is properly reset on error
      setIsGeneratingWriterSuggestions(false);
      setWriterSuggestionsStarted(false);
      setWriterSuggestionsReady(false);
    }
  };

  // FIXED: Enhanced writer suggestions handler with proper mentor validation and token integration
const handleShowWriterSuggestions = async () => {
  try {
    // FIXED: Validate we have the required data
    if (!feedback && !partialFeedback) {
      console.error('❌ No feedback available for writer suggestions');
      return;
    }

    if (!session?.user?.id) {
      console.error('❌ No user session for writer suggestions');
      return;
    }

    // FIXED: Ensure we have a proper selectedMentor
    const currentFeedback = feedback || partialFeedback!;
    let mentorForSuggestions = selectedMentor;

    // FIXED: Create a fallback mentor if selectedMentor is undefined
    if (!mentorForSuggestions) {
      console.warn('⚠️ No selectedMentor found, creating fallback mentor');
      
      if (currentFeedback.mentorId === 'blended') {
        mentorForSuggestions = {
          id: 'blended',
          name: 'Blended Mentors',
          tone: 'analytical',
          styleNotes: 'AI generated blended feedback',
          avatar: '',
          accent: '#8b5cf6',
          mantra: 'Multiple perspectives reveal the full picture.',
          feedbackStyle: 'analytical' as const,
          priorities: ['clarity', 'structure'],
          analysisApproach: 'comprehensive'
        };
      } else {
        // Try to find the mentor from the feedback
        const mentorFromData = mentors.find(m => m.id === currentFeedback.mentorId);
        if (mentorFromData) {
          mentorForSuggestions = mentorFromData;
        } else {
          // Last resort: create a generic mentor
          mentorForSuggestions = {
            id: currentFeedback.mentorId || 'generic',
            name: 'Script Mentor',
            tone: 'analytical',
            styleNotes: 'AI generated feedback',
            avatar: '',
            accent: '#8b5cf6',
            mantra: 'Focus on the craft.',
            feedbackStyle: 'analytical' as const,
            priorities: ['clarity'],
            analysisApproach: 'systematic'
          };
        }
      }
    }

    console.log('✍️ Opening writer suggestions with validated mentor:', {
      mentorId: mentorForSuggestions.id,
      mentorName: mentorForSuggestions.name,
      feedbackId: currentFeedback.id,
      userId: session.user.id
    });

    // NEW: Enhanced token validation using useTokens hook
    try {
      const canProceed = await validateTokensBeforeAction('writer_agent');
      if (!canProceed) {
        console.log('❌ Insufficient tokens for Writer Agent');
        return;
      }

      console.log('✅ Token validation passed for Writer Agent');
    } catch (error) {
      console.warn('⚠️ Token validation error, showing suggestions anyway:', error);
      // Continue anyway - the RewriteSuggestions component will handle token errors
    }

    // Set the mentor and show the suggestions
    setSelectedMentorId(mentorForSuggestions.id);
    setShowWriterSuggestions(true);

  } catch (error) {
    console.error('❌ Error in writer suggestions:', error);
    // Still show the UI even on error - let the component handle it
    setShowWriterSuggestions(true);
  }
};
  
  // PRESERVED: Complete feedback mode change handler
  const handleFeedbackModeChange = async (mode: FeedbackMode) => {
    setFeedbackMode(mode);
    
    // For chunked feedback, mode changes are handled locally in the component
    if (feedback && (feedback.isChunked || (feedback as any).chunks)) {
      return;
    }
    
    // For single scene feedback, regenerate if needed
    if (currentScene && selectedMentorId && selectedMentorId !== 'blended' && feedback) {
      const hasDualContent = Boolean(feedback.structuredContent && feedback.scratchpadContent);
      
      if (!hasDualContent) {
        const mentor = mentors.find(m => m.id === selectedMentorId);
        if (mentor) {
          const abortController = new AbortController();
          await handleSingleSceneFeedback(currentScene, mentor, abortController);
        }
      }
    }
  };

  // ENHANCED: Complete blended mentors feedback with token integration + ALL original progressive processing
  const handleBlendMentors = async (mentorWeights: MentorWeights) => {
    const targetScene = currentScene || (currentScript && selectedChunkId ?
      currentScript.chunks.find(chunk => chunk.id === selectedChunkId) : null);

    if (!targetScene) return;

    const selectedMentorsList = mentors.filter(mentor =>
      Object.keys(mentorWeights).includes(mentor.id)
    );

    if (selectedMentorsList.length > 0) {
  setIsGeneratingFeedback(true);
  setShowProgressiveProgress(true);
  setPartialFeedback(null);
  setTokenError(null);

      
      // ✅ FIX: Create NEW abort controller for consistent reference throughout
      const activeAbortController = new AbortController();
      setCurrentAbortController(activeAbortController);
      const abortSignal = activeAbortController.signal;

      // ✅ FIX: Add abortion listener to cleanup state if external cancellation occurs
      abortSignal.addEventListener('abort', () => {
        console.log('🛑 Blended feedback aborted via signal');
        setIsGeneratingFeedback(false);
        setShowProgressiveProgress(false);
        setProgressiveProgress(null);
        setPartialFeedback(null);
      });

      try {
        console.log('🔀 Starting progressive blended feedback with unified UI...', {
          mentors: selectedMentorsList.map(m => m.name),
          targetType: currentScript ? 'chunked' : 'single',
          userId: session?.user?.id,
          hasSession: !!session?.user
        });

        // ✅ ALWAYS show initial progress regardless of path
        setProgressiveProgress({
          currentChunk: 1,
          totalChunks: 1,
          chunkTitle: targetScene.title,
          progress: 10,
          message: `Starting blended analysis from ${selectedMentorsList.length} mentors...`,
          isRetrying: false,
          retryCount: 0,
          completedChunks: [],
          failedChunks: [],
          processingType: 'blended',
          mentorCount: selectedMentorsList.length,
          blendingMentors: selectedMentorsList.map(m => m.name)
        });

        // Create blended mentor object for progressive processing
        const blendedMentor = {
          id: 'blended',
          name: 'Blended Mentors',
          tone: 'Multi-perspective approach',
          styleNotes: `Combined insights from: ${selectedMentorsList.map(m => m.name).join(', ')}`,
          avatar: 'https://images.pexels.com/photos/7102/notes-macbook-study-conference.jpg?auto=compress&cs=tinysrgb&w=600',
          accent: '#8b5cf6',
          mantra: 'Multiple perspectives reveal the full picture.',
          feedbackStyle: 'analytical' as const,
          priorities: ['multi-perspective-analysis'],
          analysisApproach: 'blended'
        };
        
        if (currentScript && currentScript.chunks.length > 1) {
          // NEW: Enhanced token-aware blended chunked feedback with useTokens integration
          if (session?.user) {
            // Pre-validate tokens using useTokens hook
            const canProceed = await validateTokensBeforeAction('blended_feedback');
            if (!canProceed) {
              console.log('❌ Token validation failed for blended feedback');
              return;
            }

            console.log('✅ Token validation passed, proceeding with blended feedback');

            const result = await feedbackChunkService.generateChunkedFeedback({
              userId: session.user.id,
              chunks: currentScript.chunks,
              mentor: blendedMentor,
              characters: characters,
              actionType: 'blended_feedback',
              scriptId: currentScript.id,
              onProgress: (progress) => {
                // ✅ FIX: Check abort signal in progress callback FIRST
                if (abortSignal.aborted) {
                  console.log('🛑 Progress callback detected cancellation - skipping UI update');
                  return;
                }

                setProgressiveProgress({
                  ...progress,
                  message: `Blending ${selectedMentorsList.length} mentors for ${progress.chunkTitle}`,
                  processingType: 'blended' as any,
                  mentorCount: selectedMentorsList.length,
                  blendingMentors: selectedMentorsList.map(m => m.name)
                });

                // FIXED: Added defensive null checks for completedChunks
                const completedChunks = progress.completedChunks || [];

                // Show partial blended results
                if (completedChunks.length > 0 && !partialFeedback) {
                  const partialResult = {
                    id: `partial-blended-feedback-${Date.now()}`,
                    mentorId: 'blended',
                    sceneId: currentScript.id,
                    timestamp: new Date(),
                    isChunked: true,
                    chunks: completedChunks,
                    summary: {
                      overallStructure: `Blending ${selectedMentorsList.length} mentors: ${progress.currentChunk}/${progress.totalChunks} sections...`,
                      keyStrengths: ['Multi-perspective analysis in progress'],
                      majorIssues: (progress.failedChunks || []).length > 0 ?
                        [`${(progress.failedChunks || []).length} sections need additional blending`] : [],
                      globalRecommendations: ['Blended mentor analysis in progress']
                    }
                  } as any;

                  setPartialFeedback(partialResult);
                }
              },
              abortSignal: abortSignal
            });


            // ✅ FIX: ALWAYS check abort signal before setting results
            if (!abortSignal.aborted) {
              if (result.success) {
                const blendedFeedback = {
                  id: result.feedback.id,
                  mentorId: 'blended',
                  sceneId: currentScript.id,
                  timestamp: result.feedback.timestamp,
                  isChunked: true,
                  chunks: result.feedback.chunks,
                  summary: {
                    ...result.feedback.summary,
                    overallStructure: `Blended analysis from ${selectedMentorsList.length} mentors: ${result.feedback.summary.overallStructure}`
                  }
                } as any;

                setFeedback(blendedFeedback);
                // Token balance automatically refreshed by useTokens hook
                console.log('✅ Blended feedback complete, tokens automatically refreshed');

                // NEW: Auto-save blended feedback to library
                try {
                  // Extract mentor IDs and names for blended feedback
                  const blendedMentorIds = selectedMentorsList.map(m => m.id);
                  const blendedMentorNames = selectedMentorsList.map(m => m.name).join(', ');

                  // Determine effective script context
                  const effectiveScriptId = currentScript?.id || scene.id;
                  const effectiveScriptTitle = currentScript?.title || scene.title;
                  const effectivePages = currentScript
                    ? (currentScript.totalPages ? `Pages 1-${currentScript.totalPages}` : `${currentScript.chunks.length} Sections`)
                    : 'Single Scene';
                  const effectiveScriptContent = currentScript?.originalContent || scene.content;

                  console.log('📚 Auto-saving blended feedback to library:', {
                    scriptId: effectiveScriptId,
                    scriptTitle: effectiveScriptTitle,
                    mentorIds: blendedMentorIds,
                    mentorNames: blendedMentorNames,
                    pages: effectivePages,
                    feedbackId: blendedFeedback.id
                  });

                  await feedbackLibraryService.saveFeedbackSessionToLibrary(
                    effectiveScriptId,
                    effectiveScriptTitle,
                    blendedMentorIds,
                    blendedMentorNames,
                    effectivePages,
                    blendedFeedback,
                    effectiveScriptContent
                  );
                  console.log('✅ Blended feedback auto-saved to library successfully');
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                  console.warn('⚠️ Blended feedback auto-save failed (non-critical):', errorMessage);
                  console.warn('Blended feedback auto-save diagnostic info:', {
                    scriptId: currentScript?.id || scene.id,
                    scriptTitle: currentScript?.title || scene.title,
                    feedbackId: blendedFeedback?.id,
                    mentorCount: selectedMentorsList.length,
                    selectedMentors: selectedMentorsList.map(m => m.name)
                  });
                  // Never throw - auto-save failure shouldn't break feedback generation
                }

                // Enable writer suggestions for blended chunked feedback
                if (selectedChunkId) {
                  const selectedChunk = currentScript.chunks.find(c => c.id === selectedChunkId);
                  const chunkFeedback = result.feedback.chunks.find(cf => cf.chunkId === selectedChunkId);

                  if (selectedChunk && chunkFeedback && !(chunkFeedback as any).processingError) {
                    setIsGeneratingWriterSuggestions(true);
                    setWriterSuggestionsStarted(true);
                    generateWriterSuggestionsInBackground(selectedChunk, blendedFeedback, activeAbortController);
                  }
                }
              } else {
                handleTokenError(result.error || 'Blended chunked feedback failed', 'blended_feedback');
              }
            } else {
              console.log('🛑 Blended chunked feedback was cancelled - not setting results');
              return; // ✅ FIX: Early return on cancellation
            }
          } else {
            // PRESERVED: Fallback to original progressive processing without tokens
            const newFeedback = await progressiveFeedbackService.processChunksProgressively(
              currentScript.chunks,
              blendedMentor,
              characters,
              (progress) => {
                // ✅ FIX: Check abort signal in fallback progress callback too
                if (abortSignal.aborted) {
                  console.log('🛑 Fallback progress callback detected cancellation');
                  return;
                }
                
                setProgressiveProgress({
                  ...progress,
                  message: `Blending ${selectedMentorsList.length} mentors for ${progress.chunkTitle}`,
                  processingType: 'blended' as any,
                  mentorCount: selectedMentorsList.length,
                  blendingMentors: selectedMentorsList.map(m => m.name)
                });

                // FIXED: Added defensive null checks for completedChunks
                const completedChunks = progress.completedChunks || [];

                // Show partial blended results
                if (completedChunks.length > 0 && !partialFeedback) {
                  const partialResult = {
                    id: `partial-blended-feedback-${Date.now()}`,
                    mentorId: 'blended',
                    sceneId: currentScript.id,
                    timestamp: new Date(),
                    isChunked: true,
                    chunks: completedChunks,
                    summary: {
                      overallStructure: `Blending ${selectedMentorsList.length} mentors: ${progress.currentChunk}/${progress.totalChunks} sections...`,
                      keyStrengths: ['Multi-perspective analysis in progress'],
                      majorIssues: (progress.failedChunks || []).length > 0 ?
                        [`${(progress.failedChunks || []).length} sections need additional blending`] : [],
                      globalRecommendations: ['Blended mentor analysis in progress']
                    }
                  } as any;

                  setPartialFeedback(partialResult);
                }
              },
              {
                maxConcurrent: 1,
                retryAttempts: 2, // Fewer retries for blended since it's more complex
                baseDelay: 4000, // Longer delay for blended processing
                exponentialBackoff: true,
                showPartialResults: true,
                processingType: 'blended',
                abortSignal: abortSignal
              }
            );

            // ✅ FIX: Check cancellation in fallback path
            if (!abortSignal.aborted) {
              const blendedFeedback = {
                id: newFeedback.id,
                mentorId: 'blended',
                sceneId: currentScript.id,
                timestamp: newFeedback.timestamp,
                isChunked: true,
                chunks: newFeedback.chunks,
                summary: {
                  ...newFeedback.summary,
                  overallStructure: `Blended analysis from ${selectedMentorsList.length} mentors across ${currentScript.chunks.length} sections: ${newFeedback.summary.overallStructure}`
                }
              } as any;

              setFeedback(blendedFeedback);
            } else {
              console.log('🛑 Blended chunked fallback feedback was cancelled');
              return; // ✅ FIX: Early return on cancellation
            }
            
            // Enable writer suggestions for blended chunked feedback
            if (selectedChunkId) {
              const selectedChunk = currentScript.chunks.find(c => c.id === selectedChunkId);
              const chunkFeedback = newFeedback.chunks.find(cf => cf.chunkId === selectedChunkId);
              
              if (selectedChunk && chunkFeedback && !(chunkFeedback as any).processingError) {
                setIsGeneratingWriterSuggestions(true);
                setWriterSuggestionsStarted(true);
                generateWriterSuggestionsInBackground(selectedChunk, blendedFeedback, new AbortController());
              }
            }
          }

        } else {
          // Handle blended feedback for single scene
          const sceneForBlending = 'chunkType' in targetScene ? {
            id: targetScene.id,
            title: targetScene.title,
            content: targetScene.content,
            characters: targetScene.characters
          } as ScriptScene : targetScene;
          
          // NEW: Enhanced token-aware blended single scene feedback with useTokens integration
          if (session?.user) {
            // Pre-validate tokens using useTokens hook
            const canProceed = await validateTokensBeforeAction('blended_feedback');
            if (!canProceed) {
              console.log('❌ Token validation failed for blended single scene feedback');
              return;
            }

            console.log('✅ Token validation passed, proceeding with blended single scene feedback');

            // ✅ FIX: Check cancellation before showing progress
            if (abortSignal.aborted) {
              console.log('🛑 Single scene blended feedback cancelled before token validation');
              return;
            }
            
            // ✅ Show progress during token validation
            setProgressiveProgress(prev => prev ? {
              ...prev,
              progress: 25,
              message: `Validating tokens for blended ${selectedMentorsList.length} mentor analysis...`
            } : null);

            // Token-aware single scene blended processing
            const result = await aiFeedbackService.generateBlendedFeedback({
              userId: session.user.id,
              scene: sceneForBlending,
              mentors: selectedMentorsList,
              mentorWeights: mentorWeights,
              characters: characters,
              actionType: 'blended_feedback',
              scriptId: sceneForBlending.id,
              sceneId: sceneForBlending.id,
              abortSignal: abortSignal
            });

            // ✅ Show progress during processing
            setProgressiveProgress(prev => prev ? {
              ...prev,
              progress: 75,
              message: `Blending ${selectedMentorsList.length} mentor perspectives via backend API...`
            } : null);

            // ✅ Brief processing simulation to show progress
            await new Promise(resolve => setTimeout(resolve, 800));

            if (result.success) {
              // ✅ Show completion progress
              setProgressiveProgress(prev => prev ? {
                ...prev,
                progress: 100,
                message: `Blended analysis from ${selectedMentorsList.length} mentors complete!`,
                completedChunks: [{
                  chunkId: sceneForBlending.id,
                  chunkTitle: sceneForBlending.title,
                  structuredContent: result.feedback.structuredContent || '',
                  scratchpadContent: result.feedback.scratchpadContent || '',
                  mentorId: 'blended',
                  timestamp: new Date(),
                  categories: result.feedback.categories || {
                    structure: 'Blended analysis',
                    dialogue: 'Blended analysis',
                    pacing: 'Blended analysis',
                    theme: 'Blended analysis'
                  }
                }]
              } : null);

              // Brief delay to show completion
              await new Promise(resolve => setTimeout(resolve, 1000));

              // ✅ FIX: Check if operation was cancelled before setting results
              if (!abortSignal.aborted) {
                setFeedback(result.feedback);
                // Token balance automatically refreshed by useTokens hook
                console.log('✅ Blended feedback complete, tokens automatically refreshed');

                // Enable writer suggestions for blended single scene feedback
                setIsGeneratingWriterSuggestions(true);
                setWriterSuggestionsStarted(true);
                generateWriterSuggestionsInBackground(sceneForBlending, result.feedback, activeAbortController);
              } else {
                console.log('🛑 Blended single scene feedback was cancelled - not setting results');
                return; // ✅ FIX: Early return on cancellation
              }
            } else {
              handleTokenError(result.error || 'Blended single scene feedback failed', 'blended_feedback');
            }
          } else {
            // PRESERVED: Fallback to original progressive processing without tokens
            // Convert single scene to chunk format for progressive processing
            const sceneAsChunk: ScriptChunk = {
              id: sceneForBlending.id,
              title: `${sceneForBlending.title} (Blended Analysis)`,
              content: sceneForBlending.content,
              characters: sceneForBlending.characters,
              chunkType: 'scene',
              startPage: 1,
              endPage: 1
            };

            const newFeedback = await progressiveFeedbackService.processChunksProgressively(
              [sceneAsChunk],
              blendedMentor,
              characters,
              (progress) => {
                setProgressiveProgress({
                  ...progress,
                  message: `Blending insights from ${selectedMentorsList.length} mentors: ${progress.message}`,
                  processingType: 'blended' as any,
                  mentorCount: selectedMentorsList.length,
                  blendingMentors: selectedMentorsList.map(m => m.name)
                });
                
                // Show partial blended results for single scene
                if (progress.completedChunks.length > 0 && !partialFeedback) {
                  const partialResult = {
                    id: `partial-blended-feedback-${Date.now()}`,
                    mentorId: 'blended',
                    sceneId: sceneForBlending.id,
                    timestamp: new Date(),
                    isChunked: false,
                    structuredContent: progress.completedChunks[0]?.structuredContent || '',
                    scratchpadContent: progress.completedChunks[0]?.scratchpadContent || '',
                    categories: progress.completedChunks[0]?.categories || {
                      structure: 'Blending perspectives...',
                      dialogue: 'Blending perspectives...',
                      pacing: 'Blending perspectives...',
                      theme: 'Blending perspectives...'
                    }
                  } as any;
                  
                  setPartialFeedback(partialResult);
                }
              },
              {
                maxConcurrent: 1,
                retryAttempts: 2,
                baseDelay: 3000,
                exponentialBackoff: true,
                showPartialResults: true,
                processingType: 'blended'
              }
            );
            
            // ✅ FIX: Check for cancellation before setting feedback
            if (!abortSignal.aborted) {
              // Convert back to single scene feedback format
              const chunkFeedback = newFeedback.chunks[0];
              const blendedFeedback = {
                id: newFeedback.id,
                mentorId: 'blended',
                sceneId: sceneForBlending.id,
                timestamp: newFeedback.timestamp,
                isChunked: false,
                structuredContent: chunkFeedback?.structuredContent || '',
                scratchpadContent: chunkFeedback?.scratchpadContent || '',
                categories: chunkFeedback?.categories || {
                  structure: 'Blended analysis',
                  dialogue: 'Blended analysis',
                  pacing: 'Blended analysis',
                  theme: 'Blended analysis'
                }
              } as Feedback;

              setFeedback(blendedFeedback);

              // NEW: Auto-save blended single scene feedback to library
              try {
                const blendedMentorIds = selectedMentorsList.map(m => m.id);
                const blendedMentorNames = selectedMentorsList.map(m => m.name).join(', ');

                console.log('📚 Auto-saving blended single scene feedback to library:', {
                  sceneId: sceneForBlending.id,
                  sceneTitle: sceneForBlending.title,
                  mentorIds: blendedMentorIds,
                  mentorNames: blendedMentorNames,
                  feedbackId: blendedFeedback.id
                });

                await feedbackLibraryService.saveFeedbackSessionToLibrary(
                  sceneForBlending.id,
                  sceneForBlending.title,
                  blendedMentorIds,
                  blendedMentorNames,
                  'Single Scene',
                  blendedFeedback,
                  sceneForBlending.content
                );
                console.log('✅ Blended single scene feedback auto-saved to library successfully');
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.warn('⚠️ Blended single scene feedback auto-save failed (non-critical):', errorMessage);
                // Never throw - auto-save failure shouldn't break feedback generation
              }
            } else {
              console.log('🛑 Blended single scene fallback feedback was cancelled');
              return; // ✅ FIX: Early return on cancellation
            }

            // Enable writer suggestions for blended single scene feedback
            setIsGeneratingWriterSuggestions(true);
            setWriterSuggestionsStarted(true);
            generateWriterSuggestionsInBackground(sceneForBlending, blendedFeedback, new AbortController());
          }
        }

        // Set blended mentor state
        setSelectedMentorId('blended');
        setFeedbackMode('structured');
        setRewrite(null);
        setDiffLines([]);
        setPartialFeedback(null);
        
        console.log('✅ Token-aware progressive blended feedback complete');
        
      } catch (error: any) {
        // ✅ FIX: Better error handling for cancellation
        if (abortSignal.aborted || error.message?.includes('cancelled')) {
          console.log('✅ Blended feedback generation was properly cancelled');
          // Don't set error state for intentional cancellation
          return;
        } else {
          console.error('❌ Progressive blended feedback failed:', error);
          if (error.message?.includes('Insufficient tokens')) {
            handleTokenError(error.message, 'blended_feedback');
          }
          setFeedback(null);
          setPartialFeedback(null);
          setWriterSuggestionsReady(false);
          setShowWriterSuggestions(false);
          setWriterSuggestionsStarted(false);
        }
      } finally {
        // ✅ FIX: Only cleanup if not cancelled (cancelled cleanup handled by handleCancelProcessing)
        if (!abortSignal.aborted) {
          setIsGeneratingFeedback(false);
          setShowProgressiveProgress(false);
          setProgressiveProgress(null);
          setCurrentAbortController(null);
        }
      }
    }
  };

  // PRESERVED: Complete script upload handler
  const handleScriptUploaded = async (content: string, title: string, parsedCharacters: Record<string, any>) => {
    try {
      setIsLoadingScript(true);
      console.log('🔄 Clearing ALL previous script state for new upload');

      // ENHANCED: Comprehensive state reset for new upload
      setFeedback(null);
      setPartialFeedback(null);
      setRewrite(null);
      setDiffLines([]);
      setRewriteEvaluation(null);
      setWriterSuggestionsReady(false);
      setShowWriterSuggestions(false);
      setWriterSuggestionsStarted(false);
      setWriterSuggestions(null);
      setRewriteAnalysis(null);
      setSelectedChunkId(null);
      setTokenError(null);

      // Cancel any ongoing processing
      if (currentAbortController) {
        console.log('🛑 Cancelling ongoing processing for new upload');
        currentAbortController.abort();
        setCurrentAbortController(null);
      }
      setIsGeneratingFeedback(false);
      setShowProgressiveProgress(false);
      setProgressiveProgress(null);
      
      // Determine if this should be chunked
      const chunkingOptions = ScriptChunker.recommendChunkingStrategy(content);
      const shouldChunk = content.length > 50000; // Chunk scripts longer than ~50k characters
      
      if (shouldChunk) {
        console.log('📄 Creating chunked script with FIXED timing...', chunkingOptions);

        // Process as chunked script
        const fullScript = ScriptChunker.chunkScript(content, title, parsedCharacters, chunkingOptions);

        // Normalize character data for chunked script to prevent type errors
        const normalizedCharacters = CharacterDataNormalizer.normalizeCharacters(fullScript.characters);
        console.log('🔧 Normalized character data for chunked script:', normalizedCharacters);

        // Update the script with normalized characters
        fullScript.characters = normalizedCharacters;

        // FIXED TIMING: Save to database FIRST to get proper UUID
        console.log('💾 Saving chunked script to database first to get UUID...');
        let databaseUUID: string;

        try {
          databaseUUID = await supabaseScriptService.saveScript(
            content,
            title,
            content, // processedContent
            normalizedCharacters,
            null, // No feedback yet
            undefined,
            undefined,
            fullScript
          );

          if (!databaseUUID || typeof databaseUUID !== 'string') {
            throw new Error('Invalid UUID returned from database');
          }

          console.log('✅ Chunked script saved to Supabase with UUID:', {
            tempId: fullScript.id,
            databaseUUID: databaseUUID,
            title: fullScript.title,
            chunkCount: fullScript.chunks.length
          });
        } catch (error) {
          console.error('❌ Failed to save chunked script to Supabase:', error);
          // FALLBACK: Use temporary ID but warn about potential issues
          console.warn('⚠️ Using temporary script ID, auto-save will be skipped:', fullScript.id);
          databaseUUID = fullScript.id;
        }

        // NOW update script with proper UUID
        fullScript.id = databaseUUID; // Use database UUID immediately

        // Set state with proper UUID
        setCurrentScript(fullScript);
        setCurrentScene(null);
        setSelectedChunkId(fullScript.chunks[0]?.id || null);
        setCharacters(normalizedCharacters);

        // NOW generate feedback with proper UUID - auto-save will work correctly
        if (selectedMentorId && selectedMentorId !== 'blended') {
          const mentor = mentors.find(m => m.id === selectedMentorId);
          if (mentor) {
            console.log('🎬 Generating feedback for chunked script with UUID:', {
              scriptUUID: fullScript.id,
              scriptTitle: fullScript.title,
              mentorId: mentor.id,
              chunkCount: fullScript.chunks.length
            });

            const abortController = new AbortController();
            await handleChunkedFeedback(fullScript, mentor, abortController);
          }
        }
      } else {
        // Process as single scene with FIXED timing - Save to database FIRST
        const processedContent = processSceneText(content);
        const tempScriptId = `script_${title.replace(/\s+/g, '_')}_${Date.now()}`;

        // Process characters with normalization FIRST
        console.log('🔧 Processing characters for single scene upload');

        // Start fresh - don't merge with existing characters
        const freshCharacters: Record<string, { name: string, notes: string[] }> = {};

        // Process characters from the new script only
        const extractedCharacters = Object.keys(parsedCharacters).length > 0
          ? Object.keys(parsedCharacters)
          : characterManager.extractCharactersFromScene(processedContent);

        extractedCharacters.forEach(char => {
          if (char && char.trim()) {
            // Check if we have parsed character data
            const parsedCharacterData = parsedCharacters[char];

            if (parsedCharacterData && typeof parsedCharacterData === 'object') {
              // Use parsed character data if available
              freshCharacters[char] = {
                name: char,
                notes: Array.isArray(parsedCharacterData.notes)
                  ? parsedCharacterData.notes
                  : parsedCharacterData.notes
                    ? [String(parsedCharacterData.notes)]
                    : [`Character: ${char}`]
              };

              // Add additional character details if available
              if (parsedCharacterData.appearances) {
                freshCharacters[char].notes.push(`Appears in ${parsedCharacterData.appearances} scenes`);
              }

              if (parsedCharacterData.dialogueCount) {
                freshCharacters[char].notes.push(`Has ${parsedCharacterData.dialogueCount} lines of dialogue`);
              }

              if (parsedCharacterData.arc_phase) {
                freshCharacters[char].notes.push(`Arc Phase: ${parsedCharacterData.arc_phase}`);
              }

              if (parsedCharacterData.emotional_state) {
                freshCharacters[char].notes.push(`Emotional State: ${parsedCharacterData.emotional_state}`);
              }
            } else {
              // Create basic character entry
              freshCharacters[char] = {
                name: char,
                notes: [`Introduced in scene: ${title || 'Uploaded Scene'}`]
              };
            }
          }
        });

        // Normalize the fresh characters
        const normalizedCharacters = CharacterDataNormalizer.normalizeCharacters(freshCharacters);
        console.log('🔧 Normalized fresh characters for single scene:', normalizedCharacters);

        // FIXED TIMING: Save to database FIRST to get proper UUID
        console.log('💾 Saving single scene to database first to get UUID...');
        let databaseUUID: string;

        try {
          databaseUUID = await supabaseScriptService.saveScript(
            content,
            title,
            processedContent,
            normalizedCharacters,
            null // No feedback yet
          );

          if (!databaseUUID || typeof databaseUUID !== 'string') {
            throw new Error('Invalid UUID returned from database');
          }

          console.log('✅ Single scene saved to Supabase with UUID:', {
            tempId: tempScriptId,
            databaseUUID: databaseUUID,
            title: title
          });
        } catch (error) {
          console.error('❌ Failed to save single scene to Supabase:', error);
          // FALLBACK: Use temporary ID but warn about potential issues
          console.warn('⚠️ Using temporary script ID, auto-save will be skipped:', tempScriptId);
          databaseUUID = tempScriptId;
        }

        // NOW create scene with proper UUID
        const newScene: ScriptScene = {
          id: databaseUUID, // Use database UUID immediately
          title: title || 'Uploaded Scene',
          content: processedContent,
          characters: Object.keys(parsedCharacters) || characterManager.extractCharactersFromScene(processedContent)
        };

        // Set state with proper UUID
        setCurrentScene(newScene);
        setCurrentScript(null);
        setSelectedChunkId(null);
        setCharacters(normalizedCharacters);

        // NOW generate feedback with proper UUID - auto-save will work correctly
        if (selectedMentorId && selectedMentorId !== 'blended') {
          const mentor = mentors.find(m => m.id === selectedMentorId);
          if (mentor) {
            console.log('🎬 Generating feedback for scene with UUID:', {
              sceneUUID: newScene.id,
              sceneTitle: newScene.title,
              mentorId: mentor.id
            });

            const abortController = new AbortController();
            await handleSingleSceneFeedback(newScene, mentor, abortController);
          }
        }
        
        }
      
      setWriterSuggestionsReady(false);
      setShowWriterSuggestions(false);
      setWriterSuggestionsStarted(false);
      setRewrite(null);
      setDiffLines([]);
      
    } catch (error) {
      console.error('Error processing script:', error);
    } finally {
      setIsLoadingScript(false);
    }
  };

  // ENHANCED: Complete chunk selection with proper state reset
  const handleChunkSelection = (chunkId: string) => {
    console.log('📍 Switching to chunk:', chunkId);
    setSelectedChunkId(chunkId);

    // ENHANCED: Reset ALL chunk-related state when switching
    setWriterSuggestionsReady(false);
    setShowWriterSuggestions(false);
    setWriterSuggestionsStarted(false);
    setWriterSuggestions(null); // Clear any existing writer suggestions
    setRewrite(null); // Clear any chunk-specific rewrites
    setDiffLines([]); // Clear diff lines
    setRewriteEvaluation(null); // Clear evaluation
    setTokenError(null); // Clear any token errors

    // Cancel any ongoing writer suggestions generation for previous chunk
    if (isGeneratingWriterSuggestions) {
      console.log('🛑 Cancelling ongoing writer suggestions for chunk switch');
      setIsGeneratingWriterSuggestions(false);
    }
    
    // If we have chunked feedback and the new chunk has feedback, start generating writer suggestions
    if (feedback && (feedback.isChunked || (feedback as any).chunks) && currentScript) {
      const chunk = currentScript.chunks.find(c => c.id === chunkId);
      const chunkFeedback = (feedback as any).chunks?.find((cf: any) => cf.chunkId === chunkId);
      
      if (chunk && chunkFeedback && !(chunkFeedback as any).processingError) {
        console.log('🎨 Starting writer suggestions for chunk:', chunk.title);
        setIsGeneratingWriterSuggestions(true);
        setWriterSuggestionsStarted(true);
        generateWriterSuggestionsInBackground(chunk, feedback, new AbortController());
      }
    }
  };

  // PRESERVED: Complete scene display helper
  const getCurrentDisplayScene = (): ScriptScene | null => {
    if (currentScene) {
      return currentScene;
    }
    
    if (currentScript && selectedChunkId) {
      const chunk = currentScript.chunks.find(c => c.id === selectedChunkId);
      if (chunk) {
        return {
          id: chunk.id,
          title: chunk.title,
          content: chunk.content,
          characters: chunk.characters
        };
      }
    }
    
    return null;
  };

  // PRESERVED: Complete scene update handler
  const handleUpdateScene = async (updatedScene: ScriptScene) => {
    const processedScene = {
      ...updatedScene,
      content: processSceneText(updatedScene.content)
    };
    
    if (currentScript && selectedChunkId) {
      // Update chunk in script
      const updatedScript = {
        ...currentScript,
        chunks: currentScript.chunks.map(chunk => 
          chunk.id === selectedChunkId ? {
            ...chunk,
            content: processedScene.content
          } : chunk
        )
      };
      setCurrentScript(updatedScript);
    } else {
      // Update single scene
      setCurrentScene(processedScene);
    }
    
    // Regenerate feedback using progressive processing
    if (selectedMentorId && selectedMentorId !== 'blended') {
      const mentor = mentors.find(m => m.id === selectedMentorId);
      if (mentor) {
        setWriterSuggestionsReady(false);
        setShowWriterSuggestions(false);
        setWriterSuggestionsStarted(false);
        
        const abortController = new AbortController();
        await handleSingleSceneFeedback(processedScene, mentor, abortController);
      }
    }
    
    setRewrite(null);
    setDiffLines([]);
  };

  // FIXED: Add this near your other utility functions
  const ensureMentorAvailable = (feedbackObj: Feedback) => {
    // Try to get the mentor from the current selection first
    if (selectedMentor && selectedMentor.id === feedbackObj.mentorId) {
      return selectedMentor;
    }

    // Try to find the mentor from the mentors data
    const mentorFromData = mentors.find(m => m.id === feedbackObj.mentorId);
    if (mentorFromData) {
      return mentorFromData;
    }

    // Create a fallback mentor based on feedback
    if (feedbackObj.mentorId === 'blended') {
      return {
        id: 'blended',
        name: 'Blended Mentors',
        tone: 'analytical',
        styleNotes: 'AI generated blended feedback',
        avatar: '',
        accent: '#8b5cf6',
        mantra: 'Multiple perspectives reveal the full picture.',
        feedbackStyle: 'analytical' as const,
        priorities: ['clarity', 'structure'],
        analysisApproach: 'comprehensive'
      };
    }

    // Generic fallback
    return {
      id: feedbackObj.mentorId || 'generic',
      name: 'Script Mentor',
      tone: 'analytical',
      styleNotes: 'AI generated feedback',
      avatar: '',
      accent: '#8b5cf6',
      mantra: 'Focus on the craft.',
      feedbackStyle: 'analytical' as const,
      priorities: ['clarity'],
      analysisApproach: 'systematic'
    };
  };

  // PRESERVED: Complete rewrite generation handler
  const handleGenerateRewrite = async () => {
    const displayScene = getCurrentDisplayScene();
    if (!displayScene || !feedback) return;
    
    const newRewrite = enhancedScriptRewriter.generateRewrite(
      displayScene,
      [feedback]
    );
    
    const processedRewrite = {
      ...newRewrite,
      content: processSceneText(newRewrite.content)
    };
    
    const diff = enhancedScriptRewriter.generateDiff(
      displayScene.content,
      processedRewrite.content
    );
    
    setRewrite(processedRewrite);
    setDiffLines(diff);
    
    try {
      const evaluation = await enhancedScriptRewriter.evaluateRewrite(
        displayScene,
        processedRewrite,
        [feedback]
      );
      setRewriteEvaluation(evaluation.evaluation);
    } catch (error) {
      console.error('Error evaluating rewrite:', error);
    }
  };

  // PRESERVED: Complete character note handler
  const handleAddCharacterNote = (character: string, note: string) => {
    const updatedCharacters = { ...characters };
    
    if (!updatedCharacters[character]) {
      updatedCharacters[character] = {
        name: character,
        notes: []
      };
    }
    
    updatedCharacters[character].notes.push(note);
    
    // Normalize the updated characters to prevent future errors
    const normalizedCharacters = CharacterDataNormalizer.normalizeCharacters(updatedCharacters);
    console.log('🔧 Normalized characters after adding note:', normalizedCharacters);
    setCharacters(normalizedCharacters);
  };
  
  // NEW: Handle feedback library selection
  const handleFeedbackLibrarySelection = async (item: any) => {
    try {
      console.log('📚 Loading complete feedback session from library:', item.id);
      const decryptedItem = await feedbackLibraryService.getFeedbackLibraryItem(item.id);

      // Check if this is a complete session or legacy feedback
      if (decryptedItem.content.sessionType === 'complete_feedback') {
        // Load complete feedback session
        const session = decryptedItem.content;
        const restoredFeedback = session.feedback;

        // NEW: Restore overview content if available
        if (session.overviewContent) {
          (restoredFeedback as any).overviewContent = session.overviewContent;
        }

        setFeedback(restoredFeedback);
        setSelectedMentorId(restoredFeedback.mentorId || 'blended');

        // ENHANCED: Restore script context from library item metadata
        console.log('📄 Restoring script context from library item');

        // Create synthetic script context from library item
        const syntheticScriptId = item.script_id || `loaded-script-${item.id}`;
        const syntheticScriptTitle = item.title || 'Loaded Script';
        const syntheticPages = item.pages || 'Unknown Pages';

        // ENHANCED: Check if this is chunked feedback and restore with real content
        if (restoredFeedback.isChunked || (restoredFeedback as any).chunks) {
          // Create a restored full script for chunked feedback
          const chunks = (restoredFeedback as any).chunks || [];
          const savedScriptContent = session.scriptContent || 'No script content saved with this feedback.';

          console.log('📄 Restoring chunked script with actual content:', {
            chunkCount: chunks.length,
            hasScriptContent: !!session.scriptContent,
            contentLength: savedScriptContent.length
          });

          const restoredScript: FullScript = {
            id: syntheticScriptId,
            title: syntheticScriptTitle,
            originalContent: savedScriptContent,
            processedContent: savedScriptContent,
            chunks: chunks.map((chunk: any, index: number) => {
              // ENHANCED: Try to extract actual chunk content from saved script
              let chunkContent = '';
              if (savedScriptContent && chunk.chunkTitle) {
                // Try to find the chunk content in the saved script
                const chunkStart = savedScriptContent.indexOf(chunk.chunkTitle);
                if (chunkStart !== -1) {
                  // Extract content for this chunk (simplified approach)
                  const nextChunkIndex = index + 1;
                  const nextChunk = chunks[nextChunkIndex];
                  if (nextChunk) {
                    const nextChunkStart = savedScriptContent.indexOf(nextChunk.chunkTitle, chunkStart + 1);
                    chunkContent = savedScriptContent.substring(chunkStart, nextChunkStart).trim();
                  } else {
                    // Last chunk - take rest of content
                    chunkContent = savedScriptContent.substring(chunkStart).trim();
                  }
                }
              }

              // Fallback to a portion of the script if chunk-specific extraction fails
              if (!chunkContent && savedScriptContent) {
                const chunkSize = Math.ceil(savedScriptContent.length / chunks.length);
                const startPos = index * chunkSize;
                const endPos = Math.min((index + 1) * chunkSize, savedScriptContent.length);
                chunkContent = savedScriptContent.substring(startPos, endPos).trim();
              }

              return {
                id: chunk.chunkId || `chunk-${index}`,
                title: chunk.chunkTitle || `Section ${index + 1}`,
                content: chunkContent || `Section ${index + 1} content`,
                characters: chunk.characters || [],
                chunkType: 'section' as const,
                startPage: chunk.startPage || (index * 15) + 1,
                endPage: chunk.endPage || ((index + 1) * 15)
              };
            }),
            characters: characters,
            totalPages: parseInt(syntheticPages.replace(/\D/g, '')) || chunks.length * 15,
            chunkingStrategy: 'pages' as const
          };

          setCurrentScript(restoredScript);
          setCurrentScene(null);
          setSelectedChunkId(chunks[0]?.chunkId || null);

          console.log('✅ Chunked script restored successfully');
        } else {
          // ENHANCED: Create a restored scene for single feedback with real content
          const savedScriptContent = session.scriptContent || 'No script content saved with this feedback.';

          console.log('📄 Restoring single scene with actual content:', {
            hasScriptContent: !!session.scriptContent,
            contentLength: savedScriptContent.length
          });

          const restoredScene: ScriptScene = {
            id: syntheticScriptId,
            title: syntheticScriptTitle,
            content: savedScriptContent,
            characters: Object.keys(characters)
          };

          setCurrentScene(restoredScene);
          setCurrentScript(null);
          setSelectedChunkId(null);

          console.log('✅ Single scene restored successfully');
        }
      } else {
        // Handle legacy feedback format
        setFeedback(decryptedItem.content);
        setSelectedMentorId(decryptedItem.content.mentorId || 'blended');

        // ENHANCED: Create script context for legacy feedback with better fallback
        const legacyScriptId = item.script_id || `legacy-script-${item.id}`;
        const legacyScriptTitle = item.title || 'Legacy Script';

        // FIXED: Try to find any saved content or create meaningful placeholder
        let legacyContent = 'Legacy script content - original content not available.';

        // Check if there's any content in the feedback itself that might give us script info
        if (decryptedItem.content.structuredContent) {
          legacyContent = `Script content not saved with this feedback session.\n\nFeedback was provided for: ${legacyScriptTitle}\n\nTo generate new writer suggestions, you can edit this area with your actual script content.`;
        } else if (decryptedItem.content.scratchpadContent) {
          legacyContent = `Script content not saved with this feedback session.\n\nFeedback was provided for: ${legacyScriptTitle}\n\nTo generate new writer suggestions, you can edit this area with your actual script content.`;
        }

        const legacyScene: ScriptScene = {
          id: legacyScriptId,
          title: legacyScriptTitle,
          content: legacyContent,
          characters: Object.keys(characters)
        };

        setCurrentScene(legacyScene);
        setCurrentScript(null);
        setSelectedChunkId(null);

        console.log('✅ Legacy feedback restored with placeholder content');
      }
      
      // NEW: Close both libraries and ensure we're in main view
      setShowFeedbackLibrary(false);
      setShowLibrary(false);
      
      console.log('✅ Complete feedback session loaded from library successfully');
      
      // NEW: Ensure we navigate to the main feedback view
      // The feedback will be automatically displayed in the main workspace
    } catch (error) {
      console.error('❌ Failed to load feedback session from library:', error);
      setTokenError(`Failed to load feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // NEW: Handle writer suggestions library selection
  const handleWriterSuggestionsLibrarySelection = async (item: any) => {
    try {
      console.log('📚 Loading writer suggestions session from library:', item.id);
      const decryptedItem = await feedbackLibraryService.getFeedbackLibraryItem(item.id);

      // Check if this is a complete suggestions session
      if (decryptedItem.content.sessionType === 'writer_suggestions') {
        const session = decryptedItem.content;

        // Restore the original feedback context if available
        if (session.originalFeedback) {
          setFeedback(session.originalFeedback);
          setSelectedMentorId(session.originalFeedback.mentorId || 'blended');
        }

        // FIXED: Load writer suggestions - use the complete session object with library flag
        setWriterSuggestions({
          ...session,
          isFromLibrary: true  // ✅ ADD THIS FLAG
        });
        setShowWriterSuggestions(true);
      } else {
        // Handle legacy format - wrap in session-like structure
        const legacySession = {
          suggestions: decryptedItem.content.suggestions || [],
          sessionType: 'writer_suggestions',
          timestamp: new Date().toISOString(),
          isFromLibrary: true
        };
        setWriterSuggestions(legacySession);
        setShowWriterSuggestions(true);
      }

      // Close both libraries and ensure we're in main view
      setShowFeedbackLibrary(false);
      setShowLibrary(false);

      console.log('✅ Writer suggestions session loaded from library successfully');

    } catch (error) {
      console.error('❌ Failed to load writer suggestions session from library:', error);
      setTokenError(`Failed to load writer suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // PRESERVED: Complete mentor selection logic
  const selectedMentor = selectedMentorId === 'blended' 
    ? { 
        id: 'blended', 
        name: 'Blended Feedback', 
        tone: 'Mixed styles',
        styleNotes: 'Combined insights from multiple mentors',
        avatar: 'https://images.pexels.com/photos/7102/notes-macbook-study-conference.jpg?auto=compress&cs=tinysrgb&w=600',
        accent: '#8b5cf6',
        mantra: 'Multiple perspectives reveal the full picture.',
        feedbackStyle: 'analytical' as const,
        priorities: ['multi-perspective-analysis'],
        analysisApproach: 'blended'
      }
    : mentors.find(m => m.id === selectedMentorId) || mentors[0];

  const displayScene = getCurrentDisplayScene();
  const isChunkedScript = currentScript && currentScript.chunks.length > 1;

  // PRESERVED: Complete WriterSuggestionsButton with blended feedback support + token awareness
  const WriterSuggestionsButton = () => {
    const currentFeedback = feedback || partialFeedback;
    if (!currentFeedback || !displayScene) return null;
    
    if (!writerSuggestionsStarted) return null;
    
    if (showWriterSuggestions) return null;
    
    // For chunked feedback, check if the current chunk has valid feedback
    if (currentFeedback.isChunked || (currentFeedback as any).chunks) {
      const chunkFeedback = (currentFeedback as any).chunks?.find((cf: any) => 
        cf.chunkId === selectedChunkId
      );
      
      if (!chunkFeedback || (chunkFeedback as any).processingError) {
        return null; // Don't show button if current chunk doesn't have valid feedback
      }
    }
    
    // FIXED: Properly handle blended feedback - don't exclude it
    const isBlendedFeedback = currentFeedback.mentorId === 'blended';
    
    return (
      <div className="mt-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-yellow-400" />
            <div>
              <h4 className="font-medium text-white">Enhanced Writer Suggestions</h4>
              <p className="text-sm text-slate-400">
                {isGeneratingWriterSuggestions 
                  ? `AI is generating specific rewrite suggestions${isChunkedScript && selectedChunkId ? ` for ${getChunkDisplayTitle(selectedChunkId)}` : ''}...` 
                  : `Ready! Concrete before/after examples with ${isBlendedFeedback ? 'blended mentor' : 'mentor'} guidance${isChunkedScript && selectedChunkId ? ` for ${getChunkDisplayTitle(selectedChunkId)}` : ''}`
                }
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <button
              onClick={handleShowWriterSuggestions}
              disabled={isGeneratingWriterSuggestions || !selectedMentor}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${isGeneratingWriterSuggestions || !selectedMentor
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : writerSuggestionsReady
                  ? 'bg-green-600 hover:bg-green-500 text-white animate-pulse'
                  : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                }`}
            >
              {isGeneratingWriterSuggestions ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                  Preparing...
                </>
              ) : writerSuggestionsReady ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  <div className="flex flex-col items-start">
                    <span>View Suggestions</span>
                    {isChunkedScript && selectedChunkId && (
                      <span className="text-xs opacity-90">
                        {getChunkDisplayTitle(selectedChunkId)}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-4 h-4 border-2 border-yellow-300 border-t-transparent rounded-full animate-spin"></div>
                  Preparing...
                </>
              )}
            </button>

            <div className="flex items-center gap-1 text-xs text-slate-400 justify-end">
              {/* NEW: Enhanced token cost preview with balance check */}
              {session?.user && (
                <div className="flex items-center gap-2">
                  <TokenCostPreview
                    actionType="writer_agent"
                    className="text-xs text-slate-400"
                  />
                  {/* Show balance status for this action */}
                  {canAffordAction('writer_agent') ? (
                    <span className="text-green-400 text-xs">✓ Can afford</span>
                  ) : (
                    <span className="text-red-400 text-xs">⚠ Insufficient tokens</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // PRESERVED: Complete Enhanced Script Workspace render function
  const renderScriptWorkspace = () => {
    if (!displayScene) return null;

    // Get appropriate title for the workspace
    let workspaceTitle = displayScene.title;
    if (isChunkedScript && selectedChunkId) {
      workspaceTitle = getChunkDisplayTitle(selectedChunkId);
    }

    return (
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Files className="h-5 w-5 text-yellow-400" />
            Script Workspace
          </h3>
          
          {/* Display current section info */}
          {workspaceTitle && (
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-700/50 px-3 py-1.5 rounded-lg">
              <FileText className="h-4 w-4" />
              <span>{workspaceTitle}</span>
              {isChunkedScript && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30">
                  Section {selectedChunkId ? currentScript?.chunks.findIndex(c => c.id === selectedChunkId) + 1 : 1} of {currentScript?.chunks.length}
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SceneEditor 
            scene={displayScene}
            feedback={feedback || undefined}
            onSave={handleUpdateScene}
            onGenerateRewrite={handleGenerateRewrite}
          />
          
          {(feedback || partialFeedback) && (
            <div className="space-y-6">
              {/* Show partial feedback with processing indicator, or final feedback */}
              {partialFeedback && !feedback ? (
                <div className="space-y-4">
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-yellow-400 animate-spin" />
                    <span className="text-yellow-400 text-sm font-medium">
                      Partial Results - Processing continues in background
                    </span>
                  </div>

                  {/* Check if this is chunked feedback by checking for chunks property */}
                  {partialFeedback.isChunked || (partialFeedback as any).chunks ? (
                    <ChunkedFeedbackView 
                        chunkedFeedback={partialFeedback as any}
                        mentor={selectedMentor}
                        feedbackMode={feedbackMode}
                        onModeChange={selectedMentorId !== 'blended' ? handleFeedbackModeChange : undefined}
                        onShowWriterSuggestions={handleShowWriterSuggestions}
                        selectedChunkId={selectedChunkId} // NEW: Pass selected chunk ID
                        // NEW: Pass script context for library saving
                        scriptId={currentScript?.id}
                        scriptTitle={currentScript?.title}
                        currentPages={getCurrentPageRange()}
                      />
                  ) : (
                    <FeedbackView 
                      feedback={partialFeedback} 
                      mentor={selectedMentor}
                      feedbackMode={feedbackMode}
                      onModeChange={selectedMentorId !== 'blended' ? handleFeedbackModeChange : undefined}
                      onShowWriterSuggestions={handleShowWriterSuggestions}
                    />
                  )}
                </div>
              ) : feedback ? (
                <>
                    {/* Check if this is chunked feedback by checking for chunks property */}
                    {feedback.isChunked || (feedback as any).chunks ? (
                      <ChunkedFeedbackView
                        chunkedFeedback={feedback as any}
                        mentor={selectedMentor}
                        feedbackMode={feedbackMode}
                        onModeChange={selectedMentorId !== 'blended' ? handleFeedbackModeChange : undefined}
                        onShowWriterSuggestions={handleShowWriterSuggestions}
                        selectedChunkId={selectedChunkId} // NEW: Pass selected chunk ID
                        // NEW: Pass script context for library saving
                        scriptId={currentScript?.id}
                        scriptTitle={currentScript?.title}
                        currentPages={getCurrentPageRange()}
                      />
                    ) : (
                      <FeedbackView
                        feedback={feedback}
                        mentor={selectedMentor}
                        feedbackMode={feedbackMode}
                        onModeChange={selectedMentorId !== 'blended' ? handleFeedbackModeChange : undefined}
                        onShowWriterSuggestions={handleShowWriterSuggestions}
                      />
                    )}
                  </>
              ) : null}
            </div>
          )}
        </div>
        
        {/* ENHANCED: Pass all required props to RewriteSuggestions with optional mentor */}
        {showWriterSuggestions && (feedback || partialFeedback) && displayScene && (
          <div className="mt-6">
            <RewriteSuggestions
              originalScene={displayScene}
              feedback={feedback || partialFeedback!}
              mentor={selectedMentor}
              selectedChunkId={selectedChunkId}
              userId={session?.user?.id}
              scriptId={currentScript?.id}
              scriptTitle={currentScript?.title}
              currentPages={getCurrentPageRange()}
              // FIXED: Only pass saved suggestions when actually from library
              savedSuggestions={writerSuggestions?.sessionType === 'writer_suggestions' ? writerSuggestions : undefined}
              isFromLibrary={writerSuggestions?.sessionType === 'writer_suggestions' && !!writerSuggestions.isFromLibrary}
              onClose={() => {
                console.log('🔄 Closing writer suggestions and resetting state');
                setShowWriterSuggestions(false);
                setWriterSuggestions(null);
              }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* ENHANCED: UNIFIED PROGRESSIVE PROCESSING PROGRESS with completion handling */}
      {showProgressiveProgress && progressiveProgress && (
        <ProgressiveProcessingProgress
          progress={progressiveProgress}
          mentor={selectedMentor}
          onCancel={handleCancelProcessing}
          onComplete={() => {
            console.log('🎉 Processing completed - dismissing modal');
            setShowProgressiveProgress(false);
            setProgressiveProgress(null);
            setIsGeneratingFeedback(false);
          }}
        />
      )}

      {/* PRESERVED: SIMPLIFIED script loading state when not generating feedback */}
      {isLoadingScript && !isGeneratingFeedback && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400"></div>
            <p className="text-white">Loading script...</p>
            <p className="text-slate-400 text-sm">
              {isChunkedScript ? 'Preparing chunked analysis' : 'Preparing script analysis'}
            </p>
          </div>
        </div>
      )}

      <main className="container-fluid mx-auto px-4 py-8 max-w-[2400px]">
        {/* ENHANCED: Simplified header for main content area */}
        <div className="mb-8 flex justify-between items-center">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BookOpenCheck className="h-6 w-6 text-yellow-400" />
              ScriptMentor AI
              {isChunkedScript && (
                <span className="bg-purple-600/20 text-purple-400 px-2 py-1 rounded-full text-xs font-medium border border-purple-500/30 ml-2">
                  <Layers className="h-3 w-3 inline mr-1" />
                  Token-Integrated Progressive Analysis
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* NEW: Enhanced Token Display with useTokens integration */}
            {session?.user && (
              <div className="flex items-center gap-3">
                <TokenDisplay
                  userId={session.user.id}
                  showDetailed={showTokenDetails}
                  className="text-white"
                  onTokenUpdate={(tokens) => {
                    console.log('💰 Token display updated:', tokens);
                    // Token state is automatically managed by useTokens hook
                  }}
                />
                <button
                  onClick={() => setShowTokenDetails(!showTokenDetails)}
                  className="text-slate-300 hover:text-white transition-colors"
                  title="Toggle detailed token view"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
                {/* NEW: Balance status indicator */}
                {balanceStatus === 'critical' && (
                  <div className="flex items-center gap-1 text-red-400 text-xs">
                    <AlertCircle className="h-3 w-3" />
                    <span>Low tokens</span>
                  </div>
                )}
              </div>
            )}

            <LibraryButton
              showLibrary={showLibrary}
              onToggle={handleToggleLibrary}
            />
            <button
              onClick={handleToggleFeedbackLibrary}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 ease-in-out transform text-white library-button ${showFeedbackLibrary
                ? 'bg-green-600 hover:bg-green-500 hover:scale-105 active:scale-95'
                : 'bg-slate-700 hover:bg-slate-600 hover:scale-105 active:scale-95'
                }`}
              type="button"
            >
              {showFeedbackLibrary ? <BookMarked className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
              <span className="font-medium">{showFeedbackLibrary ? 'Hide Feedback Library' : 'Feedback Library'}</span>
            </button>
          </div>
        </div>

        {/* NEW: Enhanced Token Error Display with useTokens integration */}
        {tokenError && (
          <div className="mb-6">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <span className="text-red-300 text-sm">{tokenError}</span>
                <button
                  onClick={() => {
                    // Token error is automatically managed by useTokens hook
                    console.log('🔄 Token error cleared via useTokens hook');
                  }}
                  className="ml-auto text-red-400 hover:text-red-300"
                >
                  ×
                </button>
              </div>
              {/* NEW: Show current balance and upgrade suggestions */}
              {userTokens && balance < 10 && (
                <div className="mt-2 text-xs text-red-300">
                  Current balance: {balance} tokens • Monthly allowance: {monthlyAllowance}
                  {tier === 'free' && (
                    <span className="block mt-1">
                      Consider upgrading to Creator tier for {' '}
                      <span className="font-medium">500 monthly tokens</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* NEW: Enhanced Detailed Token Display with real-time data */}
        {showTokenDetails && userTokens && session?.user && (
          <div className="mb-6">
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 border border-slate-700">
              <TokenDisplay
                userId={session.user.id}
                showDetailed={true}
                className="text-white"
              />
              {/* NEW: Real-time usage insights */}
              <div className="mt-4 pt-4 border-t border-slate-600">
                <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Real-time Token Insights
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
                  <div>
                    <span className="block text-slate-300 font-medium">Usage This Month</span>
                    <span>{usageThisMonth} / {monthlyAllowance} tokens</span>
                  </div>
                  <div>
                    <span className="block text-slate-300 font-medium">Days Until Reset</span>
                    <span>{daysUntilReset} days</span>
                  </div>
                  <div>
                    <span className="block text-slate-300 font-medium">Balance Status</span>
                    <span className={`capitalize ${balanceStatus === 'healthy' ? 'text-green-400' :
                        balanceStatus === 'warning' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                      {balanceStatus}
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-300 font-medium">Current Tier</span>
                    <span className="capitalize">{tier}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* ENHANCED: Improved conditional rendering with proper library coordination */}
        {showLibrary ? (
          <div key="script-library" className="fade-in">
            <ScriptLibrary onScriptSelected={handleScriptSelected} />
          </div>
        ) : showFeedbackLibrary ? (
          <div key="feedback-library" className="fade-in">
            <FeedbackLibrary
              onFeedbackSelected={handleFeedbackLibrarySelection}
              onWriterSuggestionsSelected={handleWriterSuggestionsLibrarySelection}
            />
          </div>
        ) : (
          <div key="main-content" className="fade-in">
            <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-200px)]">
              <div className="lg:w-[450px] min-w-[450px] space-y-8">
                <div className="sticky top-4">
                  {/* PRESERVED: 1. Script Uploader (stays in position 1) */}
                  <ScriptUploader onScriptUploaded={handleScriptUploaded} />

                  {/* ENHANCED: 2. Mentors Section with token integration */}
                  <div className="mt-8">
                        {session?.user ? (
                          <div className="space-y-4">
                            {/* Show token status for mentors */}
                            {userTokens && balance < 20 && (
                              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                                  <AlertCircle className="h-4 w-4" />
                                  <span className="font-medium">Low Token Balance</span>
                                </div>
                                <p className="text-yellow-300 text-xs mt-1">
                                  You have {balance} tokens remaining. Single feedback costs 15 tokens, chunked feedback costs 25 tokens.
                                </p>
                                {tier === 'free' && (
                                  <p className="text-yellow-300 text-xs mt-1">
                                    Consider upgrading to Creator tier for 500 monthly tokens.
                                  </p>
                                )}
                              </div>
                            )}

                            <MentorSelection
                              mentors={mentors}
                              onSelectMentor={handleSelectMentor}
                              onBlendMentors={handleBlendMentors}
                              selectedMentorId={selectedMentorId}
                              feedbackMode={feedbackMode}
                              onFeedbackModeChange={handleFeedbackModeChange}
                            />
                          </div>
                        ) : (
                      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                        <div className="text-center">
                          <Coins className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                          <h3 className="font-semibold text-white mb-2">Sign In for AI Feedback</h3>
                          <p className="text-slate-400 text-sm">
                            Create an account to generate personalized screenplay feedback with our AI mentors.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PRESERVED: 3. Combined Script Navigation & Character Memory Panel */}
                  <div className="mt-8">
                    <ScriptNavigationPanel
                      characters={characters}
                      onAddNote={handleAddCharacterNote}
                      chunks={currentScript?.chunks || []}
                      selectedChunkId={selectedChunkId}
                      onSelectChunk={handleChunkSelection}
                      isChunkedScript={isChunkedScript ?? undefined}
                    />
                  </div>
                </div>
              </div>

              <div className="lg:flex-1">
                {renderScriptWorkspace()}

                {/* NEW: Contextual upgrade prompts */}
                {userTokens && balance < 10 && (
                  <div className="mt-6">
                    <LowTokensPrompt
                      onClose={() => {
                        console.log('🔄 Upgrade prompt closed');
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// NEW: Router-enabled App Component
const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900">
        <Routes>
          {/* Main App Route */}
          <Route path="/" element={<AppWithNavigation />} />
          
          {/* Pricing Page Route */}
          <Route path="/pricing" element={<PricingPageWithNavigation />} />
          
          {/* Subscription Management Route */}
          <Route path="/subscription" element={<SubscriptionWithNavigation />} />
          
          {/* Success Page Route */}
          <Route path="/success" element={<SuccessPageWithNavigation />} />
        </Routes>
      </div>
    </Router>
  );
};

// NEW: Wrapper Components for Different Routes
const AppWithNavigation: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userTokens, setUserTokens] = useState<any>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <NavigationHeader
        session={session}
        userTokens={userTokens}
        onSignOut={handleSignOut}
      />
      <AppContent />
    </>
  );
};

const PricingPageWithNavigation: React.FC = () => {
  const { userTokens, session } = useTokens({ 
    userId: '', 
    autoRefresh: false 
  });
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <NavigationHeader 
        session={session} 
        userTokens={userTokens} 
        onSignOut={handleSignOut} 
      />
      <PricingPage />
    </>
  );
};

const SubscriptionWithNavigation: React.FC = () => {
  const { userTokens, session } = useTokens({ 
    userId: '', 
    autoRefresh: false 
  });
  const navigate = useNavigate();
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Redirect to pricing if not authenticated
  React.useEffect(() => {
    if (!session?.user) {
      navigate('/pricing');
    }
  }, [session, navigate]);

  if (!session?.user) {
    return null; // Will redirect
  }

  return (
    <>
      <NavigationHeader 
        session={session} 
        userTokens={userTokens} 
        onSignOut={handleSignOut} 
      />
      <SubscriptionManagement />
    </>
  );
};

const SuccessPageWithNavigation: React.FC = () => {
  const { userTokens, session } = useTokens({ 
    userId: '', 
    autoRefresh: false 
  });
  const navigate = useNavigate();
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <NavigationHeader 
        session={session} 
        userTokens={userTokens} 
        onSignOut={handleSignOut} 
      />
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">
            Payment Successful!
          </h1>
          <p className="text-slate-300 mb-8">
            Your subscription has been activated. You can now access all premium features.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/')}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Start Writing
            </button>
            <button
              onClick={() => navigate('/subscription')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Manage Subscription
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;