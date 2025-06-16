// src/App.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import Auth from './components/Auth';
import Header from './components/Header';
import MentorSelection from './components/MentorSelection';
import ScriptUploader from './components/ScriptUploader';
import SceneEditor from './components/SceneEditor';
import FeedbackView from './components/FeedbackView';
import CharacterMemoryPanel from './components/CharacterMemoryPanel';
import ScriptDiff from './components/ScriptDiff';
import RewriteSuggestions from './components/RewriteSuggestions';
import ScriptLibrary from './components/ScriptLibrary';
import ChunkSelector from './components/ChunkSelector';
import ChunkedFeedbackView from './components/ChunkedFeedbackView';
import ChunkProcessingProgress from './components/ChunkProcessingProgress';
import ProgressiveProcessingProgress from './components/ProgressiveProcessingProgress';
import { mentors } from './data/mentors';
import { 
  ScriptScene, 
  Feedback, 
  MentorWeights, 
  ScriptRewrite,
  FeedbackMode,
  Character,
  FullScript,
  ScriptChunk,
  ChunkedScriptFeedback
} from './types';
import { aiFeedbackService } from './services/aiFeedbackService';
import { FeedbackChunkService } from './services/feedbackChunkService';
import { progressiveFeedbackService } from './services/progressiveFeedbackService';
import { supabaseScriptService } from './services/supabaseScriptService';
import { ScriptChunker } from './utils/scriptChunker';
import { enhancedScriptRewriter } from './utils/enhancedScriptRewriter';
import { BookOpenCheck, Files, Activity, BookText, BookOpen, BookMarked, Layers, Users, Eye, Upload } from 'lucide-react';
import { processSceneText } from './utils/scriptFormatter';
import LoadingOverlay from './components/LoadingOverlay';

const App: React.FC = () => {
  // Authentication state
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Core application state
  const [selectedMentorId, setSelectedMentorId] = useState<string>('tony-gilroy');
  const [currentScene, setCurrentScene] = useState<ScriptScene | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rewrite, setRewrite] = useState<ScriptRewrite | null>(null);
  const [diffLines, setDiffLines] = useState<string[]>([]);
  const [characters, setCharacters] = useState<Record<string, Character>>({});
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('structured');
  
  // Chunked script state
  const [fullScript, setFullScript] = useState<FullScript | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [isProcessingChunks, setIsProcessingChunks] = useState(false);
  const [chunkProgress, setChunkProgress] = useState<any>(null);
  
  // UI state
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showWriterSuggestions, setShowWriterSuggestions] = useState(false);

  // Initialize Supabase auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show auth screen if not authenticated
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth onAuthChange={setSession} />;
  }

  // Handle mentor selection with feedback mode support
  const handleSelectMentor = async (mentor: { id: string }, mode: FeedbackMode = feedbackMode) => {
    setSelectedMentorId(mentor.id);
    setFeedbackMode(mode);
    
    if (currentScene) {
      const selectedMentor = mentors.find(m => m.id === mentor.id);
      if (selectedMentor) {
        try {
          const newFeedback = await aiFeedbackService.generateDualFeedback({
            scene: currentScene,
            mentor: selectedMentor,
            characters
          });
          setFeedback(newFeedback.feedback);
          setRewrite(null);
          setDiffLines([]);
          setShowWriterSuggestions(false);
        } catch (error) {
          console.error('Failed to generate feedback:', error);
        }
      }
    }
  };

  // Handle feedback mode changes
  const handleFeedbackModeChange = async (mode: FeedbackMode) => {
    setFeedbackMode(mode);
    
    if (currentScene && selectedMentorId && selectedMentorId !== 'blended') {
      const mentor = mentors.find(m => m.id === selectedMentorId);
      if (mentor) {
        try {
          const newFeedback = await aiFeedbackService.generateFeedback({
            scene: currentScene,
            mentor,
            characters,
            mode
          });
          setFeedback(newFeedback.feedback);
        } catch (error) {
          console.error('Failed to regenerate feedback:', error);
        }
      }
    }
  };

  // Handle blended mentor feedback
  const handleBlendMentors = async (mentorWeights: MentorWeights) => {
    if (!currentScene) return;
    
    const selectedMentorsList = mentors.filter(mentor => 
      Object.keys(mentorWeights).includes(mentor.id)
    );
    
    if (selectedMentorsList.length > 0) {
      try {
        // Create blended feedback using backend service
        const blendedFeedback: Feedback = {
          id: `blended-feedback-${Date.now()}`,
          mentorId: 'blended',
          sceneId: currentScene.id,
          structuredContent: 'Blended feedback from multiple mentors...',
          scratchpadContent: 'Blended scratchpad notes...',
          timestamp: new Date(),
          categories: {
            structure: 'Blended structural analysis',
            dialogue: 'Blended dialogue feedback',
            pacing: 'Blended pacing notes',
            theme: 'Blended thematic insights'
          }
        };
        
        setFeedback(blendedFeedback);
        setSelectedMentorId('blended');
        setFeedbackMode('structured');
        setRewrite(null);
        setDiffLines([]);
        setShowWriterSuggestions(false);
      } catch (error) {
        console.error('Failed to generate blended feedback:', error);
      }
    }
  };

  // Handle script upload
  const handleScriptUploaded = async (content: string, title: string, parsedCharacters: Record<string, any>) => {
    try {
      setIsLoadingScript(true);
      
      const processedContent = processSceneText(content);
      
      // Determine if script should be chunked
      const chunkingOptions = ScriptChunker.recommendChunkingStrategy(content);
      const shouldChunk = content.length > 50000; // Chunk if over 50k characters
      
      if (shouldChunk) {
        // Create chunked script
        const chunkedScript = ScriptChunker.chunkScript(
          content,
          title,
          parsedCharacters,
          chunkingOptions
        );
        
        setFullScript(chunkedScript);
        setSelectedChunkId(chunkedScript.chunks[0]?.id || null);
        
        // Set current scene to first chunk
        if (chunkedScript.chunks.length > 0) {
          const firstChunk = chunkedScript.chunks[0];
          setCurrentScene({
            id: firstChunk.id,
            title: firstChunk.title,
            content: firstChunk.content,
            characters: firstChunk.characters
          });
        }
      } else {
        // Single scene
        const scriptId = `script_${title.replace(/\s+/g, '_')}_${Date.now()}`;
        const newScene: ScriptScene = {
          id: scriptId,
          title: title || 'Uploaded Scene',
          content: processedContent,
          characters: Object.keys(parsedCharacters)
        };
        
        setCurrentScene(newScene);
        setFullScript(null);
        setSelectedChunkId(null);
      }
      
      // Update characters
      const updatedCharacters = { ...characters };
      Object.keys(parsedCharacters).forEach(char => {
        if (!updatedCharacters[char]) {
          updatedCharacters[char] = {
            name: char,
            notes: [`Introduced in: ${title}`]
          };
        }
      });
      setCharacters(updatedCharacters);
      
      // Save to Supabase
      try {
        await supabaseScriptService.saveScript(
          content,
          title,
          processedContent,
          updatedCharacters,
          undefined,
          undefined,
          undefined,
          fullScript || undefined
        );
      } catch (error) {
        console.warn('Failed to save to Supabase:', error);
      }
      
      setRewrite(null);
      setDiffLines([]);
      setFeedback(null);
      setShowWriterSuggestions(false);
    } catch (error) {
      console.error('Error processing script:', error);
    } finally {
      setIsLoadingScript(false);
    }
  };

  // Handle script selection from library
  const handleScriptSelected = async (scriptId: string) => {
    try {
      setIsLoadingScript(true);
      setShowLibrary(false);
      
      const script = await supabaseScriptService.getScript(scriptId);
      
      if (script) {
        if (script.is_chunked && script.chunks) {
          // Load chunked script
          const chunkedScript: FullScript = {
            id: script.id,
            title: script.title,
            originalContent: script.content as string,
            processedContent: script.processed_content as string,
            chunks: script.chunks,
            characters: script.characters,
            totalPages: script.total_pages || 0,
            chunkingStrategy: script.chunking_strategy || 'pages'
          };
          
          setFullScript(chunkedScript);
          setSelectedChunkId(chunkedScript.chunks[0]?.id || null);
          
          if (chunkedScript.chunks.length > 0) {
            const firstChunk = chunkedScript.chunks[0];
            setCurrentScene({
              id: firstChunk.id,
              title: firstChunk.title,
              content: firstChunk.content,
              characters: firstChunk.characters
            });
          }
        } else {
          // Load single scene
          const scene = {
            id: script.id,
            title: script.title,
            content: script.processed_content as string,
            characters: Object.keys(script.characters)
          };
          
          setCurrentScene(scene);
          setFullScript(null);
          setSelectedChunkId(null);
        }
        
        setCharacters(script.characters);
        
        if (script.feedback) {
          setFeedback(script.feedback);
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
      }
    } catch (error) {
      console.error('Error loading script:', error);
    } finally {
      setIsLoadingScript(false);
    }
  };

  // Handle chunk selection
  const handleChunkSelected = (chunkId: string) => {
    if (!fullScript) return;
    
    const chunk = fullScript.chunks.find(c => c.id === chunkId);
    if (chunk) {
      setSelectedChunkId(chunkId);
      setCurrentScene({
        id: chunk.id,
        title: chunk.title,
        content: chunk.content,
        characters: chunk.characters
      });
      
      // Clear feedback when switching chunks
      setFeedback(null);
      setRewrite(null);
      setDiffLines([]);
      setShowWriterSuggestions(false);
    }
  };

  // Handle chunked feedback generation
  const handleGenerateChunkedFeedback = async () => {
    if (!fullScript || !selectedMentorId) return;
    
    const mentor = mentors.find(m => m.id === selectedMentorId);
    if (!mentor) return;
    
    setIsProcessingChunks(true);
    
    try {
      const feedbackService = new FeedbackChunkService();
      const chunkedFeedback = await feedbackService.generateChunkedFeedback(
        fullScript.chunks,
        mentor,
        characters,
        (progress) => setChunkProgress(progress)
      );
      
      // Create feedback object with chunked data
      const feedback: Feedback = {
        id: chunkedFeedback.id,
        mentorId: mentor.id,
        sceneId: fullScript.id,
        structuredContent: '',
        scratchpadContent: '',
        timestamp: chunkedFeedback.timestamp,
        categories: {
          structure: 'Chunked analysis complete',
          dialogue: 'Chunked analysis complete',
          pacing: 'Chunked analysis complete',
          theme: 'Chunked analysis complete'
        },
        isChunked: true,
        chunkedFeedback
      };
      
      setFeedback(feedback);
    } catch (error) {
      console.error('Failed to generate chunked feedback:', error);
    } finally {
      setIsProcessingChunks(false);
      setChunkProgress(null);
    }
  };

  // Handle scene updates
  const handleUpdateScene = async (updatedScene: ScriptScene) => {
    const processedScene = {
      ...updatedScene,
      content: processSceneText(updatedScene.content)
    };
    
    setCurrentScene(processedScene);
    
    if (selectedMentorId && selectedMentorId !== 'blended') {
      const mentor = mentors.find(m => m.id === selectedMentorId);
      if (mentor) {
        try {
          const newFeedback = await aiFeedbackService.generateDualFeedback({
            scene: processedScene,
            mentor,
            characters
          });
          setFeedback(newFeedback.feedback);
        } catch (error) {
          console.error('Failed to regenerate feedback:', error);
        }
      }
    }
    
    setRewrite(null);
    setDiffLines([]);
    setShowWriterSuggestions(false);
  };

  // Handle rewrite generation
  const handleGenerateRewrite = async () => {
    if (!currentScene || !feedback) return;
    
    try {
      const newRewrite = enhancedScriptRewriter.generateRewrite(currentScene, [feedback]);
      const processedRewrite = {
        ...newRewrite,
        content: processSceneText(newRewrite.content)
      };
      
      const diff = enhancedScriptRewriter.generateDiff(
        currentScene.content,
        processedRewrite.content
      );
      
      setRewrite(processedRewrite);
      setDiffLines(diff);
    } catch (error) {
      console.error('Failed to generate rewrite:', error);
    }
  };

  // Handle character note addition
  const handleAddCharacterNote = (character: string, note: string) => {
    const updatedCharacters = { ...characters };
    
    if (!updatedCharacters[character]) {
      updatedCharacters[character] = {
        name: character,
        notes: []
      };
    }
    
    updatedCharacters[character].notes.push(note);
    setCharacters(updatedCharacters);
  };

  // Get selected mentor
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

  // Library toggle button
  const LibraryButton = () => (
    <button
      onClick={() => setShowLibrary(!showLibrary)}
      className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
    >
      {showLibrary ? <BookMarked className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
      {showLibrary ? 'Hide Library' : 'Script Library'}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Header />
      
      {/* Loading Indicator */}
      {isLoadingScript && (
        <LoadingOverlay message="Loading script..." />
      )}

      {/* Chunk Processing Progress */}
      {isProcessingChunks && chunkProgress && (
        <ChunkProcessingProgress
          progress={chunkProgress}
          mentor={selectedMentor}
          onCancel={() => {
            setIsProcessingChunks(false);
            setChunkProgress(null);
          }}
        />
      )}
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpenCheck className="h-6 w-6 text-yellow-400" />
            ScriptMentor AI
          </h2>
          
          <LibraryButton />
        </div>
        
        {showLibrary ? (
          <ScriptLibrary onScriptSelected={handleScriptSelected} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div>
              <div className="space-y-8">
                {/* Script Upload section - now first in the sidebar */}
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Upload className="h-5 w-5 text-yellow-400" />
                    Upload Screenplay
                  </h3>
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <p className="text-slate-300 mb-4 text-sm">
                      Upload your screenplay to get AI-powered feedback from industry-inspired mentors.
                    </p>
                    <ScriptUploader onScriptUploaded={handleScriptUploaded} />
                  </div>
                </div>

                {/* Mentors section */}
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <BookText className="h-5 w-5 text-yellow-400" />
                    Mentors
                  </h3>
                  <MentorSelection 
                    mentors={mentors}
                    onSelectMentor={handleSelectMentor}
                    onBlendMentors={handleBlendMentors}
                    selectedMentorId={selectedMentorId}
                    feedbackMode={feedbackMode}
                    onFeedbackModeChange={handleFeedbackModeChange}
                  />
                </div>

                {/* Character Memory section */}
                <CharacterMemoryPanel 
                  characters={characters} 
                  onAddNote={handleAddCharacterNote}
                />

                {/* Chunk selector for chunked scripts */}
                {fullScript && (
                  <div>
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <Layers className="h-5 w-5 text-yellow-400" />
                      Script Navigation
                    </h3>
                    <ChunkSelector
                      chunks={fullScript.chunks}
                      selectedChunkId={selectedChunkId}
                      onSelectChunk={handleChunkSelected}
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="lg:col-span-2 space-y-8">
              {currentScene && (
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      <Files className="h-5 w-5 text-yellow-400" />
                      Script Workspace
                    </h3>
                    
                    {fullScript && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleGenerateChunkedFeedback}
                          disabled={isProcessingChunks}
                          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-md transition-colors"
                        >
                          <Users className="h-4 w-4" />
                          Analyze All Sections
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SceneEditor 
                      scene={currentScene}
                      feedback={feedback || undefined}
                      onSave={handleUpdateScene}
                      onGenerateRewrite={handleGenerateRewrite}
                    />
                    
                    {feedback && (
                      feedback.isChunked && feedback.chunkedFeedback ? (
                        <ChunkedFeedbackView
                          chunkedFeedback={feedback.chunkedFeedback}
                          mentor={selectedMentor}
                          feedbackMode={feedbackMode}
                          onModeChange={selectedMentorId !== 'blended' ? handleFeedbackModeChange : undefined}
                        />
                      ) : (
                        <FeedbackView 
                          feedback={feedback} 
                          mentor={selectedMentor}
                          onApplyFeedback={handleGenerateRewrite}
                          feedbackMode={feedbackMode}
                          onModeChange={selectedMentorId !== 'blended' ? handleFeedbackModeChange : undefined}
                        />
                      )
                    )}
                  </div>
                  
                  {/* Writer Suggestions */}
                  {feedback && (
                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-md font-medium flex items-center gap-2">
                          <Activity className="h-5 w-5 text-yellow-400" />
                          Writer Tools
                        </h4>
                        <button
                          onClick={() => setShowWriterSuggestions(!showWriterSuggestions)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          {showWriterSuggestions ? 'Hide' : 'Show'} Writer Suggestions
                        </button>
                      </div>
                      
                      {showWriterSuggestions && (
                        <RewriteSuggestions
                          originalScene={currentScene}
                          feedback={feedback}
                          mentor={selectedMentor}
                          selectedChunkId={selectedChunkId}
                          onClose={() => setShowWriterSuggestions(false)}
                        />
                      )}
                    </div>
                  )}
                  
                  {rewrite && diffLines.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-md font-medium mb-3 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-yellow-400" />
                        Scene Revision Analysis
                      </h4>
                      <ScriptDiff diffLines={diffLines} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;