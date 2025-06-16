// src/types/index.ts
export interface Mentor {
  id: string;
  name: string;
  tone: string;
  styleNotes: string;
  avatar: string;
  accent: string;
  mantra: string;
  feedbackStyle: 'direct' | 'contemplative' | 'analytical' | 'pragmatic' | 'strategic';
  priorities: string[];
  analysisApproach: string;
  // NEW: Enhanced mentor properties
  specificTechniques?: string[];
  voicePattern?: string;
}

export interface ScriptScene {
  id: string;
  title: string;
  content: string;
  characters: string[];
  location?: string;
  time?: string;
}

export interface Character {
  name: string;
  notes: string[];
}

// Enhanced Feedback interface to store both types
export interface Feedback {
  id: string;
  mentorId: string;
  sceneId: string;
  structuredContent: string;  // Structured feedback content
  scratchpadContent: string;  // Scratchpad feedback content
  timestamp: Date;
  categories: {
    structure: string;
    dialogue: string;
    pacing: string;
    theme: string;
  };
  // Keep legacy content field for backward compatibility
  content?: string;
  // NEW: Support for chunked feedback
  isChunked?: boolean;
  chunkedFeedback?: ChunkedScriptFeedback;
}

export interface ScriptRewrite {
  id: string;
  originalSceneId: string;
  content: string;
  feedbackApplied: string[];
  timestamp: Date;
}

export interface Session {
  id: string;
  name: string;
  scenes: ScriptScene[];
  feedback: Feedback[];
  characters: Record<string, Character>;
  rewrites: ScriptRewrite[];
  lastUpdated: Date;
}

export type FeedbackMode = 'structured' | 'scratchpad';
export type MentorWeights = Record<string, number>;

// NEW: Writer Agent Types
export interface WriterSuggestion {
  note: string;
  suggestion: string;
}

export interface WriterSuggestionsResponse {
  suggestions: WriterSuggestion[];
  success: boolean;
  mentor_id: string;
  timestamp: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

export interface WriterSuggestionsRequest {
  feedback_text: string;
  mentor_id: string;
}

// Legacy rewrite suggestions types (for backward compatibility)
export interface RewriteSuggestion {
  category: 'dialogue' | 'action' | 'structure' | 'character' | 'pacing' | 'visual';
  title: string;
  issue: string;
  originalExample: string;
  rewriteExample: string;
  explanation: string;
  mentorReasoning: string;
  lineReference?: string;
  difficulty: 'easy' | 'medium' | 'advanced';
}

export interface RewriteSuggestionsResponse {
  suggestions: RewriteSuggestion[];
  mentorSummary: string;
  overallApproach: string;
}

export interface RewriteSuggestionsApiResponse {
  success: boolean;
  suggestions: RewriteSuggestion[];
  mentorSummary: string;
  overallApproach: string;
  mentor_id: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  timestamp: string;
  error?: string;
}
// ADD these new interfaces to your existing src/types/index.ts file
// (Keep everything you already have, just add these at the end)

// NEW: Chunked script support
export interface ScriptChunk {
  id: string;
  title: string; // "Pages 1-15" or "Act I" or "Sequence 1"
  content: string;
  characters: string[];
  startPage?: number;
  endPage?: number;
  chunkType: 'pages' | 'act' | 'sequence';
  chunkIndex: number;
}

export interface ChunkFeedback {
  chunkId: string;
  chunkTitle: string;
  structuredContent: string;
  scratchpadContent: string;
  mentorId: string;
  timestamp: Date;
  categories: {
    structure: string;
    dialogue: string;
    pacing: string;
    theme: string;
  };
}

// NEW: Container for all chunk feedback
export interface ChunkedScriptFeedback {
  id: string;
  scriptId: string;
  mentorId: string;
  chunks: ChunkFeedback[];
  summary?: {
    overallStructure: string;
    keyStrengths: string[];
    majorIssues: string[];
    globalRecommendations: string[];
  };
  timestamp: Date;
}

// NEW: Support for chunked script metadata
export interface FullScript {
  id: string;
  title: string;
  originalContent: string;
  processedContent: string;
  chunks: ScriptChunk[];
  characters: Record<string, Character>;
  totalPages: number;
  chunkingStrategy: 'pages' | 'acts' | 'sequences';
  lastAnalyzed?: Date;
}
/* Additional CSS to prevent library button flickering and improve UX */

/* Smooth fade-in animation for content switching */
.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Enhanced button transitions */
button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* Prevent button text selection and improve click responsiveness */
button {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: pointer;
}

/* Better focus states for accessibility */
button:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

button:focus-visible {
  outline: 2px solid #fbbf24;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1);
}

/* Smooth hover effects */
button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

button:active {
  transform: translateY(0);
  transition-duration: 0.1s;
}

/* Specific styles for library button to prevent layout shifts */
.library-button {
  min-width: 140px;
  justify-content: center;
}

/* Smooth icon transitions */
.library-button svg {
  transition: transform 0.2s ease-in-out;
}

.library-button:hover svg {
  transform: scale(1.1);
}

/* Prevent content jumps during state changes */
.main-container {
  min-height: calc(100vh - 200px);
  will-change: contents;
}

/* Loading state improvements */
.loading-overlay {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* Performance optimizations */
.script-workspace,
.script-library {
  will-change: transform;
  transform: translateZ(0);
}

/* Smooth transitions for conditional rendering */
.content-container {
  transition: opacity 0.2s ease-in-out;
}

.content-container.hidden {
  opacity: 0;
  pointer-events: none;
}

/* Fix for potential text rendering issues */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Ensure buttons maintain their size during state changes */
button span {
  display: inline-block;
  white-space: nowrap;
}

/* Improve button responsiveness on touch devices */
@media (hover: none) and (pointer: coarse) {
  button:hover {
    transform: none;
    box-shadow: none;
  }
  
  button:active {
    transform: scale(0.98);
    transition-duration: 0.1s;
  }
}
// UPDATE your existing Feedback interface by adding these two optional properties:
// (Don't replace it, just add these lines to your current Feedback interface)

// Add these properties to your existing Feedback interface:
// isChunked?: boolean;
// chunkedFeedback?: ChunkedScriptFeedback;