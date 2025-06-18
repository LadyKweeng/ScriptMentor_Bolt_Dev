import React, { useState, useEffect, useCallback, useRef } from 'react';
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
// REMOVED: ChunkProcessingProgress, LoadingOverlay, ProcessingProgress imports
// UNIFIED: Only using ProgressiveProcessingProgress for ALL feedback processing
import ProgressiveProcessingProgress from './components/ProgressiveProcessingProgress';
import { mentors } from './data/mentors';
import { 
  ScriptScene, 
  Feedback, 
  MentorWeights, 
  ScriptRewrite,
  FeedbackMode,
  FullScript,
  ScriptChunk
} from './types';
import { CharacterMemoryManager } from './utils/characterMemory';
import { FeedbackGenerator } from './utils/feedbackGenerator';
import { ScriptChunker } from './utils/scriptChunker';
// REMOVED: ChunkProcessingProgress type import - no longer needed
import { ProcessingProgress as ProgressiveProgressType, progressiveFeedbackService } from './services/progressiveFeedbackService';
import { backendApiService } from './services/backendApiService';
import { CharacterDataNormalizer } from './utils/characterDataNormalizer';
import { BookOpenCheck, Files, Activity, BookText, BookOpen, BookMarked, BarChart3, Sparkles, ArrowDown, LogOut, Layers, FileText, RefreshCw } from 'lucide-react';
import { processSceneText } from './utils/scriptFormatter';
import ScriptLibrary from './components/ScriptLibrary';
import RewriteEvaluation from './components/RewriteEvaluation';
import { enhancedScriptRewriter } from './utils/enhancedScriptRewriter';

// Fixed LibraryButton component - moved outside App component to prevent recreation
const LibraryButton: React.FC<{
  showLibrary: boolean;
  onToggle: () => void;
}> = React.memo(({ showLibrary, onToggle }) => (
  <button
    onClick={onToggle}
    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95"
    type="button"
  >
    {showLibrary ? <BookMarked className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
    <span className="font-medium">{showLibrary ? 'Hide Library' : 'Script Library'}</span>
  </button>
));

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [selectedMentorId, setSelectedMentorId] = useState<string>('tony-gilroy');
  
  // Script state - now supports both single scenes and full scripts
  const [currentScript, setCurrentScript] = useState<FullScript | null>(null);
  const [currentScene, setCurrentScene] = useState<ScriptScene | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rewrite, setRewrite] = useState<ScriptRewrite | null>(null);
  const [diffLines, setDiffLines] = useState<string[]>([]);
  const [rewriteEvaluation, setRewriteEvaluation] = useState<any>(null);
  const [characters, setCharacters] = useState<Record<string, { name: string, notes: string[] }>>({});
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('structured');
  
  // SIMPLIFIED LOADING STATES - Removed multiple progress state variables
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [isGeneratingWriterSuggestions, setIsGeneratingWriterSuggestions] = useState(false);
  const [writerSuggestionsReady, setWriterSuggestionsReady] = useState(false);
  const [showWriterSuggestions, setShowWriterSuggestions] = useState(false);
  const [writerSuggestionsStarted, setWriterSuggestionsStarted] = useState(false);
  
  // UNIFIED PROGRESSIVE PROCESSING STATE - Single state for ALL feedback types
  const [progressiveProgress, setProgressiveProgress] = useState<ProgressiveProgressType | null>(null);
  const [showProgressiveProgress, setShowProgressiveProgress] = useState(false);
  const [partialFeedback, setPartialFeedback] = useState<Feedback | null>(null);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null); // NEW LINE
  
  // Library state - Fixed with proper state management
  const [showLibrary, setShowLibrary] = useState(false);
  
  // Ref to track if database test has been run
  const databaseTestRun = useRef(false);
  
  const characterManager = new CharacterMemoryManager(characters);
  const feedbackGenerator = new FeedbackGenerator(characterManager);

  // Fixed useEffect to prevent infinite loop
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

  // Separate effect for database testing - only run once when user is authenticated
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

  // NEW: Cleanup effect to handle component unmount
  useEffect(() => {
    return () => {
      // Cancel any ongoing processing when component unmounts
      if (currentAbortController) {
        currentAbortController.abort();
      }
      if (progressiveFeedbackService.isCurrentlyProcessing()) {
        progressiveFeedbackService.cancelProcessing();
      }
      backendApiService.cancelAllRequests();
    };
  }, [currentAbortController]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    databaseTestRun.current = false; // Reset database test flag
  };

  // Fixed toggle function without showLibrary dependency to prevent recreation
  const handleToggleLibrary = useCallback(() => {
    console.log('📚 Toggling library');
    setShowLibrary(prev => {
      const newState = !prev;
      console.log('📚 New library state:', newState);
      return newState;
    });
  }, []); // Remove showLibrary dependency

  /**
   * ENHANCED CANCEL FUNCTION - Properly stops backend processing
   */
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
        setCurrentAbortController(null);
      }

      // 3. Cancel all backend API requests
      const activeRequestCount = backendApiService.getActiveRequestCount();
      if (activeRequestCount > 0) {
        console.log(`🛑 Cancelling ${activeRequestCount} active backend requests...`);
        backendApiService.cancelAllRequests();
      }

      // 4. Reset all UI state to pre-processing state
      setShowProgressiveProgress(false);
      setIsGeneratingFeedback(false);
      setProgressiveProgress(null);
      setPartialFeedback(null);

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

      // Even if there's an error, reset the UI state
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

  // Helper function to get page-based title for chunked scripts
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

  const handleScriptSelected = async (scriptId: string) => {
    try {
      setIsLoadingScript(true);
      
      // Close library immediately when script is selected
      console.log('📖 Script selected, closing library');
      setShowLibrary(false);
      // FIXED: Clear previous state before loading new script
      console.log('🔄 Clearing previous script state for library selection');
      setFeedback(null);
      setRewrite(null);
      setDiffLines([]);
      setRewriteEvaluation(null);
      setWriterSuggestionsReady(false);
      setShowWriterSuggestions(false);
      setWriterSuggestionsStarted(false);
      
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

  /**
   * Enhanced feedback generation with proper cancellation support
   */
  const handleSelectMentor = async (mentor: { id: string }, mode: FeedbackMode = feedbackMode) => {
    console.log('🎬 Starting feedback generation with cancellation support...', {
      mentor: mentor.id,
      hasScript: !!currentScript,
      hasScene: !!currentScene
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

    // Create new abort controller for this operation
    const abortController = new AbortController();
    setCurrentAbortController(abortController);

    // Set up processing state
    setIsGeneratingFeedback(true);
    setShowProgressiveProgress(true);

    try {
      if (currentScript && currentScript.chunks.length > 1) {
        // Handle chunked script feedback
        await handleChunkedFeedback(currentScript, selectedMentor, abortController);
      } else if (currentScene) {
        // Handle single scene feedback
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
      if (!abortController.signal.aborted) {
        setIsGeneratingFeedback(false);
        setShowProgressiveProgress(false);
        setProgressiveProgress(null);
        setCurrentAbortController(null);
      }
    }
  };

  // UNIFIED: Chunked feedback uses progressive processing
  /**
   * Enhanced chunked feedback with cancellation support
   */
  const handleChunkedFeedback = async (
    script: FullScript, 
    mentor: any, 
    abortController: AbortController
  ) => {
    setIsGeneratingFeedback(true);
    setShowProgressiveProgress(true);
    setPartialFeedback(null);
    
    try {
      console.log('🚀 Starting progressive chunked feedback generation...', {
        mentor: mentor.name,
        chunkCount: script.chunks.length,
        strategy: script.chunkingStrategy
      });

      // Use progressive feedback service for better rate limit handling
      const newFeedback = await progressiveFeedbackService.processChunksProgressively(
        script.chunks,
        mentor,
        characters,
        (progress) => {
          setProgressiveProgress(progress);
          
          // Show partial results as chunks complete
          if (progress.completedChunks.length > 0 && !partialFeedback) {
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
          abortSignal: abortController.signal // NEW LINE: Pass abort signal
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
      
   } catch (error: any) {
      if (!abortController.signal.aborted) {
        console.error('❌ Progressive chunked feedback failed:', error);
        setFeedback(null);
        setPartialFeedback(null);
      }
      throw error; // Re-throw to be handled by caller
    }
  };

  // UNIFIED: Single scene feedback now uses progressive processing
  /**
   * Enhanced single scene feedback with cancellation support
   */
  const handleSingleSceneFeedback = async (
    scene: ScriptScene, 
    mentor: any, 
    abortController: AbortController
  ) => {
    setIsGeneratingFeedback(true);
    setShowProgressiveProgress(true);
    setPartialFeedback(null);
    
    try {
      console.log('🚀 Starting progressive single scene feedback...', {
        mentor: mentor.name,
        sceneLength: scene.content.length
      });

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
          abortSignal: abortController.signal // NEW LINE: Pass abort signal
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
        
        // Start writer suggestions in background (with cancellation support)
        if (!abortController.signal.aborted) {
          setIsGeneratingWriterSuggestions(true);
          setWriterSuggestionsStarted(true);
          generateWriterSuggestionsInBackground(scene, finalFeedback, abortController);
        }
      }
      
    } catch (error: any) {
      if (!abortController.signal.aborted) {
        console.error('❌ Progressive single scene feedback failed:', error);
        setFeedback(null);
        setPartialFeedback(null);
      }
      throw error; // Re-throw to be handled by caller
    }
  };

  // This fixes the state update issue inside the setTimeout
  /**
   * Enhanced writer suggestions with cancellation support
   */
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
        isBlended: feedback.mentorId === 'blended'
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
          mantra: 'Multiple perspectives reveal the full picture.'
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
      
      // CRITICAL FIX: Use setTimeout with proper state updates
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

  const handleShowWriterSuggestions = () => {
    console.log('👀 User requested writer suggestions display');
    setShowWriterSuggestions(true);
  };
  
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
          await handleSingleSceneFeedback(currentScene, mentor);
        }
      }
    }
  };

  // UNIFIED: Blended mentors feedback now uses progressive processing
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
      
      try {
        console.log('🔀 Starting progressive blended feedback...', {
          mentors: selectedMentorsList.map(m => m.name),
          targetType: currentScript ? 'chunked' : 'single'
        });

        // Create blended mentor object for progressive processing
        const blendedMentor = { 
          id: 'blended', 
          name: 'Blended Mentors', 
          tone: 'Multi-perspective approach',
          styleNotes: `Combined insights from: ${selectedMentorsList.map(m => m.name).join(', ')}`,
          avatar: 'https://images.pexels.com/photos/7102/notes-macbook-study-conference.jpg?auto=compress&cs=tinysrgb&w=600',
          accent: '#8b5cf6',
          mantra: 'Multiple perspectives reveal the full picture.'
        };
        
        if (currentScript && currentScript.chunks.length > 1) {
          // Handle blended feedback for chunked scripts using progressive processing
          const newFeedback = await progressiveFeedbackService.processChunksProgressively(
            currentScript.chunks,
            blendedMentor,
            characters,
            (progress) => {
              setProgressiveProgress({
                ...progress,
                message: `Blending ${selectedMentorsList.length} mentors for ${progress.chunkTitle}`,
                processingType: 'blended',
                mentorCount: selectedMentorsList.length,
                blendingMentors: selectedMentorsList.map(m => m.name)
              });
              
              // Show partial blended results
              if (progress.completedChunks.length > 0 && !partialFeedback) {
                const partialResult = {
                  id: `partial-blended-feedback-${Date.now()}`,
                  mentorId: 'blended',
                  sceneId: currentScript.id,
                  timestamp: new Date(),
                  isChunked: true,
                  chunks: progress.completedChunks,
                  summary: {
                    overallStructure: `Blending ${selectedMentorsList.length} mentors: ${progress.currentChunk}/${progress.totalChunks} sections...`,
                    keyStrengths: ['Multi-perspective analysis in progress'],
                    majorIssues: progress.failedChunks.length > 0 ? 
                      [`${progress.failedChunks.length} sections need additional blending`] : [],
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
              processingType: 'blended'
            }
          );

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
          
          // Enable writer suggestions for blended chunked feedback
          if (selectedChunkId) {
            const selectedChunk = currentScript.chunks.find(c => c.id === selectedChunkId);
            const chunkFeedback = newFeedback.chunks.find(cf => cf.chunkId === selectedChunkId);
            
            if (selectedChunk && chunkFeedback && !(chunkFeedback as any).processingError) {
              setIsGeneratingWriterSuggestions(true);
              setWriterSuggestionsStarted(true);
              generateWriterSuggestionsInBackground(selectedChunk, blendedFeedback);
            }
          }

        } else {
          // Handle blended feedback for single scene using progressive processing
          const sceneForBlending = 'chunkType' in targetScene ? {
            id: targetScene.id,
            title: targetScene.title,
            content: targetScene.content,
            characters: targetScene.characters
          } as ScriptScene : targetScene;
          
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
                processingType: 'blended',
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
          
          // Enable writer suggestions for blended single scene feedback
          setIsGeneratingWriterSuggestions(true);
          setWriterSuggestionsStarted(true);
          generateWriterSuggestionsInBackground(sceneForBlending, blendedFeedback);
        }

        // Set blended mentor state
        setSelectedMentorId('blended');
        setFeedbackMode('structured');
        setRewrite(null);
        setDiffLines([]);
        setPartialFeedback(null);
        
        console.log('✅ Progressive blended feedback complete');
        
      } catch (error) {
        console.error('❌ Progressive blended feedback failed:', error);
        setFeedback(null);
        setPartialFeedback(null);
        setWriterSuggestionsReady(false);
        setShowWriterSuggestions(false);
        setWriterSuggestionsStarted(false);
      } finally {
        setIsGeneratingFeedback(false);
        setShowProgressiveProgress(false);
        setProgressiveProgress(null);
      }
    }
  };

  const handleScriptUploaded = async (content: string, title: string, parsedCharacters: Record<string, any>) => {
    try {
      setIsLoadingScript(true);
      console.log('🔄 Clearing previous script state for new upload');
      setFeedback(null);
      setRewrite(null);
      setDiffLines([]);
      setRewriteEvaluation(null);
      setWriterSuggestionsReady(false);
      setShowWriterSuggestions(false);
      setWriterSuggestionsStarted(false);
      setSelectedChunkId(null);
      
      // Determine if this should be chunked
      const chunkingOptions = ScriptChunker.recommendChunkingStrategy(content);
      const shouldChunk = content.length > 50000; // Chunk scripts longer than ~50k characters
      
      if (shouldChunk) {
        console.log('📄 Creating chunked script...', chunkingOptions);
        
        // Process as chunked script
        const fullScript = ScriptChunker.chunkScript(content, title, parsedCharacters, chunkingOptions);
        
        // Normalize character data for chunked script to prevent type errors
        const normalizedCharacters = CharacterDataNormalizer.normalizeCharacters(fullScript.characters);
        console.log('🔧 Normalized character data for chunked script:', normalizedCharacters);
        
        // Update the script with normalized characters
        fullScript.characters = normalizedCharacters;
        
        setCurrentScript(fullScript);
        setCurrentScene(null);
        setSelectedChunkId(fullScript.chunks[0]?.id || null);
        setCharacters(normalizedCharacters);
        
        // Generate chunked feedback if mentor is selected
        if (selectedMentorId && selectedMentorId !== 'blended') {
          const mentor = mentors.find(m => m.id === selectedMentorId);
          if (mentor) {
            await handleChunkedFeedback(fullScript, mentor);
          }
        }
        
        // Save the chunked script to Supabase
        try {
          await supabaseScriptService.saveScript(
            content,
            title,
            content, // processedContent
            normalizedCharacters,
            feedback,
            undefined,
            undefined,
            fullScript
          );
          console.log('✅ Chunked script saved to Supabase');
        } catch (error) {
          console.error('❌ Failed to save chunked script to Supabase:', error);
        }
      } else {
        // Process as single scene (existing logic)
        const processedContent = processSceneText(content);
        const scriptId = `script_${title.replace(/\s+/g, '_')}_${Date.now()}`;
        const newScene: ScriptScene = {
          id: scriptId,
          title: title || 'Uploaded Scene',
          content: processedContent,
          characters: Object.keys(parsedCharacters) || characterManager.extractCharactersFromScene(processedContent)
        };
        
        setCurrentScene(newScene);
        setCurrentScript(null);
        setSelectedChunkId(null);
        
        // Process characters with normalization
        // FIXED: Start with a fresh characters object instead of merging with existing
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
        
        // FIXED: Set characters to the fresh normalized characters (no merging with old ones)
        setCharacters(normalizedCharacters);
        
        // Generate single scene feedback
        if (selectedMentorId && selectedMentorId !== 'blended') {
          const mentor = mentors.find(m => m.id === selectedMentorId);
          if (mentor) {
            await handleSingleSceneFeedback(newScene, mentor);
          }
        }
        
        // Save single scene to Supabase
        try {
          await supabaseScriptService.saveScript(
            content,
            title,
            processedContent,
            normalizedCharacters,
            feedback
          );
          console.log('✅ Single scene saved to Supabase');
        } catch (error) {
          console.error('❌ Failed to save single scene to Supabase:', error);
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

  // Updated handleChunkSelection to regenerate writer suggestions for the new chunk
  const handleChunkSelection = (chunkId: string) => {
    setSelectedChunkId(chunkId);
    
    // Reset writer suggestions when switching chunks
    setWriterSuggestionsReady(false);
    setShowWriterSuggestions(false);
    setWriterSuggestionsStarted(false);
    
    // If we have chunked feedback and the new chunk has feedback, start generating writer suggestions
    if (feedback && (feedback.isChunked || (feedback as any).chunks) && currentScript) {
      const chunk = currentScript.chunks.find(c => c.id === chunkId);
      const chunkFeedback = (feedback as any).chunks?.find((cf: any) => cf.chunkId === chunkId);
      
      if (chunk && chunkFeedback && !(chunkFeedback as any).processingError) {
        console.log('🎨 Starting writer suggestions for chunk:', chunk.title);
        setIsGeneratingWriterSuggestions(true);
        setWriterSuggestionsStarted(true);
        generateWriterSuggestionsInBackground(chunk, feedback);
      }
    }
  };

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
        
        await handleSingleSceneFeedback(processedScene, mentor);
      }
    }
    
    setRewrite(null);
    setDiffLines([]);
  };

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
  
  const selectedMentor = selectedMentorId === 'blended' 
    ? { 
        id: 'blended', 
        name: 'Blended Feedback', 
        tone: 'Mixed styles',
        styleNotes: 'Combined insights from multiple mentors',
        avatar: 'https://images.pexels.com/photos/7102/notes-macbook-study-conference.jpg?auto=compress&cs=tinysrgb&w=600',
        accent: '#8b5cf6'
      }
    : mentors.find(m => m.id === selectedMentorId) || mentors[0];

  const displayScene = getCurrentDisplayScene();
  const isChunkedScript = currentScript && currentScript.chunks.length > 1;

  // FIXED: Updated WriterSuggestionsButton to work with blended feedback
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
          
          <button
            onClick={handleShowWriterSuggestions}
            disabled={isGeneratingWriterSuggestions}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              isGeneratingWriterSuggestions
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
                View Suggestions
              </>
            ) : (
              <>
                <div className="w-4 h-4 border-2 border-yellow-300 border-t-transparent rounded-full animate-spin"></div>
                Preparing...
              </>
            )}
          </button>
        </div>
        
        {writerSuggestionsReady && (
          <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
            <ArrowDown className="h-3 w-3" />
            <span>
              Click above to see your personalized rewrite suggestions
              {isBlendedFeedback ? ' from blended mentors' : ''}
              {isChunkedScript && selectedChunkId ? ` for ${getChunkDisplayTitle(selectedChunkId)}` : ''}!
            </span>
          </div>
        )}
      </div>
    );
  };

  // Enhanced Script Workspace render function
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
                    />
                  ) : (
                    <FeedbackView 
                      feedback={partialFeedback} 
                      mentor={selectedMentor}
                      feedbackMode={feedbackMode}
                      onModeChange={selectedMentorId !== 'blended' ? handleFeedbackModeChange : undefined}
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
                    />
                  ) : (
                    <FeedbackView 
                      feedback={feedback} 
                      mentor={selectedMentor}
                      feedbackMode={feedbackMode}
                      onModeChange={selectedMentorId !== 'blended' ? handleFeedbackModeChange : undefined}
                    />
                  )}
                  
                  {/* Always show WriterSuggestionsButton for any feedback */}
                  <WriterSuggestionsButton />
                </>
              ) : null}
            </div>
          )}
        </div>
        
        {/* Pass selectedChunkId to RewriteSuggestions for proper chunk support */}
        {showWriterSuggestions && (feedback || partialFeedback) && displayScene && (
          <div className="mt-6">
            <RewriteSuggestions
              originalScene={displayScene}
              feedback={feedback || partialFeedback!}
              selectedChunkId={selectedChunkId}
              onClose={() => setShowWriterSuggestions(false)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* 🎯 UNIFIED PROGRESSIVE PROCESSING PROGRESS - Used for ALL feedback types */}
      {/* REMOVED: LoadingOverlay, ChunkProcessingProgress, ProcessingProgress */}
      {/* UNIFIED: Single progress component for consistent user experience */}
      {showProgressiveProgress && progressiveProgress && (
        <ProgressiveProcessingProgress
          progress={progressiveProgress}
          mentor={selectedMentor}
          onCancel={handleCancelProcessing}
        />
      )}
      
      {/* SIMPLIFIED: Only showing simple script loading state when not generating feedback */}
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
        <div className="mb-8 flex justify-between items-center">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BookOpenCheck className="h-6 w-6 text-yellow-400" />
              ScriptMentor AI
              {isChunkedScript && (
                <span className="bg-purple-600/20 text-purple-400 px-2 py-1 rounded-full text-xs font-medium border border-purple-500/30 ml-2">
                  <Layers className="h-3 w-3 inline mr-1" />
                  Unified Progressive Analysis
                </span>
              )}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <LibraryButton 
              showLibrary={showLibrary} 
              onToggle={handleToggleLibrary} 
            />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
              type="button"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
        
        {/* Enhanced conditional rendering with proper state handling */}
        {showLibrary ? (
          <div key="script-library" className="fade-in">
            <ScriptLibrary onScriptSelected={handleScriptSelected} />
          </div>
        ) : (
          <div key="main-content" className="fade-in">
            <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-200px)]">
                <div className="lg:w-[450px] min-w-[450px] space-y-8">
                  <div className="sticky top-4">
                    {/* 1. Script Uploader (stays in position 1) */}
                    <ScriptUploader onScriptUploaded={handleScriptUploaded} />

                    {/* 2. Mentors Section (moved to position 2, removed separate h3 title) */}
                    <div className="mt-8">
                      <MentorSelection
                        mentors={mentors}
                        onSelectMentor={handleSelectMentor}
                        onBlendMentors={handleBlendMentors}
                        selectedMentorId={selectedMentorId}
                        feedbackMode={feedbackMode}
                        onFeedbackModeChange={handleFeedbackModeChange}
                      />
                    </div>

                    {/* 3. Combined Script Navigation & Character Memory Panel */}
                    <div className="mt-8">
                      <ScriptNavigationPanel
                        characters={characters}
                        onAddNote={handleAddCharacterNote}
                        chunks={currentScript?.chunks || []}
                        selectedChunkId={selectedChunkId}
                        onSelectChunk={handleChunkSelection}
                        isChunkedScript={isChunkedScript}
                      />
                    </div>
                  </div>
                </div>

              <div className="lg:flex-1">
                {renderScriptWorkspace()}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;