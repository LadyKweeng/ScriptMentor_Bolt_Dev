// src/components/RewriteSuggestions.tsx - COMPLETE FIXED version preserving ALL current features + robust error handling
import React, { useState, useEffect } from 'react';
import { Feedback, Mentor, ScriptScene, ScriptChunk } from '../types';
import {
  X,
  Lightbulb,
  Sparkles,
  ClipboardCopy,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  FileText,
  Users,
  MessageSquare,
  Target,
  Zap,
  Eye,
  BarChart3,
  Clock
} from 'lucide-react';
import { writerAgentService } from '../services/writerAgentService';
import { feedbackLibraryService } from '../services/feedbackLibraryService';

interface RewriteSuggestionsProps {
  feedback: Feedback;
  originalScene: ScriptScene | ScriptChunk;
  mentor?: Mentor; // FIXED: Make mentor optional to handle undefined cases
  selectedChunkId?: string | null;
  onClose: () => void;
  userId?: string; // NEW: Add userId for token integration
  // NEW: Add script context for auto-saving
  scriptId?: string;
  scriptTitle?: string;
  currentPages?: string;
}

// PRESERVED: Complex WriterSuggestion interface from current version
interface WriterSuggestion {
  id: string;
  type: 'dialogue' | 'action' | 'structure' | 'character' | 'pacing';
  title: string;
  description: string;
  originalText?: string;
  suggestedText?: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  lineReference?: string;
}

// NEW: Simple WriterSuggestion interface for API compatibility
interface SimpleWriterSuggestion {
  note: string;
  suggestion: string;
}

const RewriteSuggestions: React.FC<RewriteSuggestionsProps> = ({
  feedback,
  originalScene,
  mentor,
  selectedChunkId,
  onClose,
  userId,
  // FIXED: Extract all script context props
  scriptId,
  scriptTitle,
  currentPages
}) => {
  const [suggestions, setSuggestions] = useState<WriterSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentChunkFeedback, setCurrentChunkFeedback] = useState<Feedback | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');

  // ENHANCED: Validate mentor prop with graceful fallback
  useEffect(() => {
    if (!mentor) {
      console.warn('⚠️ RewriteSuggestions: No mentor provided, will create fallback');
      // Don't set error immediately - let the component try to work with feedback data
      return;
    }

    console.log('✅ RewriteSuggestions initialized with mentor:', {
      mentorId: mentor.id,
      mentorName: mentor.name,
      mentorAccent: mentor.accent,
      feedbackId: feedback.id,
      sceneId: originalScene.id,
      hasUserId: !!userId
    });
  }, [mentor, feedback, originalScene, userId]);

  const isBlended = feedback.mentorId === 'blended';
  const isChunked = feedback.isChunked && (feedback.chunkedFeedback || (feedback as any).chunks);
  const sceneType = 'chunkType' in originalScene ? 'chunk' : 'scene';

  // ENHANCED: Auto-save writer suggestions to library with comprehensive fallback context
  const autoSaveWriterSuggestions = async (suggestions: WriterSuggestion[]) => {
    try {
      if (!mentor || !userId) {
        console.log('📝 Skipping auto-save: missing mentor or userId');
        return;
      }

      // ENHANCED: Create comprehensive fallback script context
      let effectiveScriptId = scriptId;
      let effectiveScriptTitle = scriptTitle;
      let effectivePages = currentPages;

      // FIXED: More robust fallback logic
      if (!effectiveScriptId) {
        effectiveScriptId = feedback.sceneId || feedback.id || originalScene.id || `writer-suggestions-${Date.now()}`;
        console.log('📝 Using fallback scriptId:', effectiveScriptId);
      }

      if (!effectiveScriptTitle) {
        effectiveScriptTitle = originalScene.title ||
          (feedback as any).scriptTitle ||
          `Writer Suggestions - ${new Date().toLocaleDateString()}`;
        console.log('📝 Using fallback scriptTitle:', effectiveScriptTitle);
      }

      if (!effectivePages) {
        if (selectedChunkId && sceneType === 'chunk') {
          effectivePages = getChunkDisplayInfo();
        } else {
          effectivePages = 'Generated from Loaded Feedback';
        }
        console.log('📝 Using fallback pages:', effectivePages);
      }

      const mentorIds = mentor.id === 'blended' ? ['blended'] : [mentor.id];
      const mentorNames = mentor.name;

      // ENHANCED: Create complete writer suggestions session format with proper structure
      const writerSuggestionsSession = {
        // Core suggestions data
        suggestions: suggestions.map(s => ({
          note: s.title,
          suggestion: s.description,
          reasoning: s.reasoning || '',
          type: s.type,
          priority: s.priority
        })),
        success: true,
        mentor_id: mentor.id,
        timestamp: new Date().toISOString(),

        // NEW: Session metadata for proper restoration
        sessionType: 'writer_suggestions',
        originalFeedback: {
          ...feedback,
          // Ensure we preserve key feedback properties
          id: feedback.id,
          mentorId: feedback.mentorId,
          sceneId: feedback.sceneId,
          timestamp: feedback.timestamp
        },

        // NEW: Enhanced script context
        scriptContext: {
          scriptId: effectiveScriptId,
          scriptTitle: effectiveScriptTitle,
          pages: effectivePages,
          sceneType: sceneType,
          selectedChunkId: selectedChunkId,
          originalSceneId: originalScene.id,
          originalSceneTitle: originalScene.title,
          isChunked: isChunked,
          mentorInfo: {
            id: mentor.id,
            name: mentor.name,
            isBlended: mentor.id === 'blended'
          }
        },
        version: '1.1'
      };

      console.log('💾 Preparing to save writer suggestions session:', {
        sessionType: writerSuggestionsSession.sessionType,
        mentorId: mentor.id,
        suggestionCount: suggestions.length,
        scriptContext: writerSuggestionsSession.scriptContext
      });

      await feedbackLibraryService.saveWriterSuggestionsToLibrary(
        effectiveScriptId,
        effectiveScriptTitle,
        mentorIds,
        mentorNames,
        effectivePages,
        writerSuggestionsSession,
        feedback
      );

      console.log('✅ Writer suggestions auto-saved to library with enhanced session data');
    } catch (error) {
      console.warn('⚠️ Failed to auto-save writer suggestions:', error);
      // Don't block the user experience for save failures
    }
  };

  // ENHANCED: Extract chunk feedback for chunked scripts with better fallback handling
  useEffect(() => {
    if (!mentor) return; // Skip if no mentor

    const extractChunkFeedback = () => {
      console.log('🔍 Extracting feedback for writer suggestions:', {
        isChunked,
        selectedChunkId,
        hasStructured: !!feedback.structuredContent,
        hasScratchpad: !!feedback.scratchpadContent,
        hasLegacyContent: !!(feedback as any).content,
        mentorId: mentor.id
      });

      if (isChunked && selectedChunkId) {
        // Find feedback for the selected chunk - handle both structure formats
        const chunkedFeedback = feedback.chunkedFeedback || { chunks: (feedback as any).chunks };
        if (chunkedFeedback?.chunks && Array.isArray(chunkedFeedback.chunks)) {
          const chunkFeedback = chunkedFeedback.chunks.find(
            chunk => chunk.chunkId === selectedChunkId
          );

          if (chunkFeedback) {
            // Convert chunk feedback to Feedback format
            const convertedFeedback: Feedback = {
              id: `chunk-feedback-${selectedChunkId}`,
              mentorId: feedback.mentorId,
              sceneId: selectedChunkId,
              structuredContent: chunkFeedback.structuredContent,
              scratchpadContent: chunkFeedback.scratchpadContent,
              content: chunkFeedback.structuredContent || chunkFeedback.scratchpadContent,
              timestamp: feedback.timestamp,
              categories: feedback.categories || {}
            };
            setCurrentChunkFeedback(convertedFeedback);
            setError(null);
            console.log('✅ Using chunk feedback for writer suggestions');
          } else {
            const errorMsg = `No feedback found for chunk ${selectedChunkId}`;
            console.warn('⚠️ ' + errorMsg);
            setError(errorMsg);
            setCurrentChunkFeedback(null);
          }
        } else {
          setError('No chunk feedback data available.');
          setCurrentChunkFeedback(null);
        }
      } else {
        // ENHANCED: Single scene feedback with improved validation and fallback
        const hasValidContent = feedback.structuredContent ||
          feedback.scratchpadContent ||
          (feedback as any).content;

        if (hasValidContent) {
          // ENHANCED: Ensure we have content field for compatibility
          const enhancedFeedback = {
            ...feedback,
            content: feedback.structuredContent ||
              feedback.scratchpadContent ||
              (feedback as any).content
          };

          setCurrentChunkFeedback(enhancedFeedback);
          setError(null);
          console.log('✅ Using enhanced single scene feedback for writer suggestions');
        } else {
          // ENHANCED: Create minimal fallback feedback if truly no content exists
          console.warn('⚠️ No valid feedback content found, creating minimal fallback');
          const fallbackFeedback: Feedback = {
            id: feedback.id || `fallback-${Date.now()}`,
            mentorId: feedback.mentorId || mentor.id,
            sceneId: feedback.sceneId || originalScene.id,
            structuredContent: `General feedback from ${mentor.name} for scene analysis.`,
            timestamp: feedback.timestamp || new Date(),
            categories: feedback.categories || {}
          };

          setCurrentChunkFeedback(fallbackFeedback);
          setError(null);
          console.log('✅ Using fallback feedback for writer suggestions');
        }
      }
    };

    extractChunkFeedback();
  }, [feedback, selectedChunkId, isChunked, mentor, originalScene.id]);

  // ENHANCED: Generate suggestions when we have valid data, regardless of source
  useEffect(() => {
    if (currentChunkFeedback && mentor) {
      generateWriterSuggestions();
    } else if (feedback && mentor && !isChunked) {
      // ENHANCED: Handle direct feedback without chunk processing
      console.log('📝 Using direct feedback for writer suggestions (non-chunked)');
      setCurrentChunkFeedback(feedback);
      setError(null);
    } else {
      setIsLoading(false);
    }
  }, [currentChunkFeedback, feedback, mentor, originalScene.id, isChunked]);

  const generateWriterSuggestions = async () => {
    // FIXED: Always validate mentor exists
    if (!mentor) {
      console.error('❌ No mentor available');
      setError('Mentor not available');
      setIsLoading(false);
      return;
    }

    if (!currentChunkFeedback) {
      console.error('❌ No feedback available');
      setError('Feedback not available');
      setIsLoading(false);
      return;
    }

    // Validate feedback content
    const feedbackText = getFeedbackText(currentChunkFeedback);
    if (!feedbackText || feedbackText.trim().length < 5) {
      console.error('❌ Insufficient feedback content');
      setError('Insufficient feedback content for generating suggestions');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('✍️ Generating Enhanced Writer Suggestions...', {
        mentor: mentor.name,
        mentorId: mentor.id,
        sceneId: originalScene.id,
        chunkId: selectedChunkId || 'single-scene',
        isBlended: feedback.mentorId === 'blended',
        feedbackLength: feedbackText.length,
        sceneType,
        hasUserId: !!userId
      });

      let response;

      // FIXED: Use the correct API based on whether we have userId for token integration
      if (userId) {
        // Use token-aware API
        const tokenResponse = await writerAgentService.generateWriterSuggestions({
          userId: userId,
          feedback: currentChunkFeedback,
          mentor: mentor,
          actionType: 'writer_agent',
          scriptId: originalScene.id
        });

        if (!tokenResponse.success) {
          throw new Error(tokenResponse.error || 'Writer suggestions generation failed');
        }

        response = tokenResponse.suggestions;
      } else {
        // Use legacy API for backward compatibility
        response = await writerAgentService.generateWriterSuggestionsLegacy(
          currentChunkFeedback,
          mentor
        );
      }

      // FIXED: Handle both simple and complex suggestion formats
      const processedSuggestions = await processApiResponse(response, feedbackText);
      setSuggestions(processedSuggestions);

      // AUTO-SAVE: Save writer suggestions to library
      autoSaveWriterSuggestions(processedSuggestions);

      console.log('✅ Enhanced Writer suggestions loaded:', {
        suggestionsCount: processedSuggestions.length,
        mentor: mentor.name,
        types: processedSuggestions.map(s => s.type),
        source: userId ? 'token-aware' : 'legacy'
      });

    } catch (err) {
      console.error('❌ Failed to generate writer suggestions:', err);

      let errorMessage = 'Failed to generate writer suggestions. Please try again.';

      if (err instanceof Error) {
        if (err.message.includes('token')) {
          errorMessage = 'Insufficient tokens for writer suggestions. Please check your token balance.';
        } else if (err.message.includes('blended')) {
          errorMessage = 'Blended feedback processing failed. Try refreshing or selecting a single mentor.';
        } else if (err.message.includes('mentor')) {
          errorMessage = 'Mentor configuration issue. Please refresh and try again.';
        } else if (err.message.includes('feedback')) {
          errorMessage = 'Feedback content is insufficient for generating suggestions.';
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // NEW: Process API response to handle both simple and complex formats
  const processApiResponse = async (response: any, feedbackText: string): Promise<WriterSuggestion[]> => {
    const suggestions = response.suggestions || [];

    // If we get simple format suggestions, convert them to complex format
    if (suggestions.length > 0 && suggestions[0].note && suggestions[0].suggestion) {
      return convertSimpleToComplexSuggestions(suggestions as SimpleWriterSuggestion[], feedbackText);
    }

    // If we already have complex format, return as-is
    if (suggestions.length > 0 && suggestions[0].id && suggestions[0].type) {
      return suggestions as WriterSuggestion[];
    }

    // If no suggestions or unknown format, return empty array
    return [];
  };

  // NEW: Convert simple suggestions to complex format for UI compatibility
  const convertSimpleToComplexSuggestions = (simpleSuggestions: SimpleWriterSuggestion[], feedbackText: string): WriterSuggestion[] => {
    return simpleSuggestions.map((simple, index) => {
      // Determine type based on content
      let type: WriterSuggestion['type'] = 'structure';
      if (simple.note.toLowerCase().includes('dialogue') || simple.suggestion.toLowerCase().includes('dialogue')) {
        type = 'dialogue';
      } else if (simple.note.toLowerCase().includes('action') || simple.suggestion.toLowerCase().includes('action')) {
        type = 'action';
      } else if (simple.note.toLowerCase().includes('character') || simple.suggestion.toLowerCase().includes('character')) {
        type = 'character';
      } else if (simple.note.toLowerCase().includes('pacing') || simple.suggestion.toLowerCase().includes('pacing')) {
        type = 'pacing';
      }

      // Determine priority based on language
      let priority: WriterSuggestion['priority'] = 'medium';
      if (simple.suggestion.toLowerCase().includes('critical') || simple.suggestion.toLowerCase().includes('important')) {
        priority = 'high';
      } else if (simple.suggestion.toLowerCase().includes('minor') || simple.suggestion.toLowerCase().includes('consider')) {
        priority = 'low';
      }

      // Generate clean, focused reasoning without repetitive boilerplate
      const reasoning = generateCleanReasoning(simple, type);

      return {
        id: `suggestion-${index + 1}`,
        type: type,
        title: simple.note || `Writer Suggestion ${index + 1}`,
        description: simple.suggestion,
        reasoning: reasoning,
        priority: priority,
        lineReference: `Based on feedback analysis`
      };
    });
  };

  // NEW: Generate clean reasoning without boilerplate text
  const generateCleanReasoning = (suggestion: SimpleWriterSuggestion, type: WriterSuggestion['type']): string => {
    const reasoningTemplates = {
      dialogue: 'This improves conversation flow and makes characters sound more natural while advancing the story.',
      action: 'This creates clearer visual storytelling that engages viewers and supports character development.',
      character: 'This strengthens character motivation and makes their choices more psychologically compelling.',
      pacing: 'This optimizes story rhythm to maintain audience engagement throughout the scene.',
      structure: 'This tightens the scene foundation and ensures every element serves the dramatic purpose.'
    };

    return reasoningTemplates[type] || reasoningTemplates.structure;
  };

  const getFeedbackText = (feedbackObj: Feedback): string => {
    // Try multiple sources for feedback content
    if (feedbackObj.structuredContent) {
      return feedbackObj.structuredContent;
    }
    if (feedbackObj.scratchpadContent) {
      return feedbackObj.scratchpadContent;
    }
    if ((feedbackObj as any).content) {
      return (feedbackObj as any).content;
    }
    return '';
  };

  // NEW: Helper function to get chunk display information
  const getChunkDisplayInfo = (): string => {
    if (!selectedChunkId || sceneType !== 'chunk') {
      return 'Script Section';
    }

    // Extract chunk information from originalScene title or use chunk ID
    if (originalScene.title && originalScene.title.includes('Pages')) {
      return originalScene.title;
    }

    // Fallback: try to extract from feedback context
    if (isChunked && feedback.chunkedFeedback?.chunks) {
      const chunkFeedback = feedback.chunkedFeedback.chunks.find(
        chunk => chunk.chunkId === selectedChunkId
      );
      if (chunkFeedback?.chunkTitle) {
        return chunkFeedback.chunkTitle;
      }
    }

    // Final fallback
    return `Script Section (${selectedChunkId.slice(-4)})`;
  };

  const copyToClipboard = async (text: string, index?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index ?? -1);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'dialogue': return <MessageSquare className="h-4 w-4" />;
      case 'action': return <Zap className="h-4 w-4" />;
      case 'structure': return <BarChart3 className="h-4 w-4" />;
      case 'character': return <Users className="h-4 w-4" />;
      case 'pacing': return <Clock className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'dialogue': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'action': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'structure': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'character': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'pacing': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertCircle className="h-3 w-3 text-red-400" />;
      case 'medium': return <Eye className="h-3 w-3 text-yellow-400" />;
      case 'low': return <CheckCircle className="h-3 w-3 text-green-400" />;
      default: return <Target className="h-3 w-3 text-slate-400" />;
    }
  };

  const filteredSuggestions = selectedType === 'all'
    ? suggestions
    : suggestions.filter(s => s.type === selectedType);

  const suggestionTypes = [...new Set(suggestions.map(s => s.type))];

  // ENHANCED: Create fallback mentor if needed with better defaults
  const effectiveMentor = mentor || {
    id: feedback.mentorId || 'fallback',
    name: feedback.mentorId === 'blended' ? 'Blended Mentors' : 'Script Mentor',
    accent: '#8b5cf6',
    avatar: '',
    tone: 'analytical',
    styleNotes: 'AI generated feedback',
    mantra: 'Focus on the craft.',
    feedbackStyle: 'analytical' as const,
    priorities: ['clarity'],
    analysisApproach: 'systematic'
  };

  const mentorAccent = effectiveMentor.accent;
  const mentorName = effectiveMentor.name;
  const mentorAvatar = effectiveMentor.avatar;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700 shadow-2xl">
        {/* PRESERVED: Enhanced Header with mentor validation */}
        <div
          className="p-4 sm:p-6 bg-slate-900 border-b border-slate-700 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: `2px solid ${mentorAccent}` }}
        >
          {/* Left Section - Mentor & Scene Info */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {mentorAvatar && (
              <img
                src={mentorAvatar}
                alt={mentorName}
                className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0"
                style={{ borderColor: mentorAccent }}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-white truncate">
                  Enhanced Writer Suggestions
                </h2>
                {isBlended && (
                  <div className="flex items-center gap-1 bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded-full text-xs font-medium border border-purple-500/30">
                    <Sparkles className="h-3 w-3" />
                    <span>Blended</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>
                    {sceneType === 'chunk' && selectedChunkId
                      ? getChunkDisplayInfo()
                      : 'Single Scene'
                    }
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{mentorName}</span>
                </div>
                {!isLoading && !error && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    <span className="text-green-400">{suggestions.length} suggestions</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Section - Close Button */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-white flex-shrink-0"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-yellow-400 mx-auto mb-4" />
                <p className="text-white font-medium mb-2">Generating Enhanced Writer Suggestions</p>
                <p className="text-slate-400 text-sm">
                  {isBlended ? 'Analyzing blended mentor insights...' : `Applying ${mentorName}'s expertise...`}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <p className="text-white font-medium mb-2">Unable to Generate Suggestions</p>
                <p className="text-slate-400 text-sm mb-4">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    generateWriterSuggestions();
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
                  type="button"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {!isLoading && !error && suggestions.length > 0 && (
            <>
              {/* PRESERVED: Filter Tabs */}
              <div className="flex border-b border-slate-700 bg-slate-800/50 overflow-x-auto">
                <button
                  onClick={() => setSelectedType('all')}
                  className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${selectedType === 'all'
                    ? 'text-white border-b-2'
                    : 'text-slate-400 hover:text-white'
                    }`}
                  style={{ borderBottomColor: selectedType === 'all' ? mentorAccent : 'transparent' }}
                  type="button"
                >
                  <Target className="h-4 w-4" />
                  All ({suggestions.length})
                </button>

                {suggestionTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap capitalize ${selectedType === type
                      ? 'text-white border-b-2'
                      : 'text-slate-400 hover:text-white'
                      }`}
                    style={{ borderBottomColor: selectedType === type ? mentorAccent : 'transparent' }}
                    type="button"
                  >
                    {getTypeIcon(type)}
                    {type} ({suggestions.filter(s => s.type === type).length})
                  </button>
                ))}
              </div>

              {/* PRESERVED: Sophisticated Suggestions List */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                  {filteredSuggestions.map((suggestion, index) => (
                    <div key={suggestion.id} className="bg-slate-700/30 rounded-lg border border-slate-600/30 p-4">
                      {/* Suggestion Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-md border ${getTypeColor(suggestion.type)}`}>
                            {getTypeIcon(suggestion.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-white font-medium truncate">{suggestion.title}</h3>
                              {getPriorityIcon(suggestion.priority)}
                            </div>
                            <p className="text-slate-400 text-sm">
                              {suggestion.description}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => copyToClipboard(suggestion.suggestedText || suggestion.description, index)}
                          className="p-2 hover:bg-slate-600 rounded-md transition-colors text-slate-400 hover:text-white"
                          title="Copy suggestion"
                          type="button"
                        >
                          {copiedIndex === index ? (
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          ) : (
                            <ClipboardCopy className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* PRESERVED: Original vs Suggested Text */}
                      {suggestion.originalText && suggestion.suggestedText && (
                        <div className="space-y-3 mb-3">
                          <div>
                            <p className="text-xs font-medium text-slate-400 mb-1">ORIGINAL:</p>
                            <div className="bg-slate-800/50 p-3 rounded border border-slate-600/50">
                              <p className="text-slate-300 text-sm">{suggestion.originalText}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-green-400 mb-1">SUGGESTED:</p>
                            <div className="bg-green-900/20 p-3 rounded border border-green-500/30">
                              <p className="text-green-100 text-sm">{suggestion.suggestedText}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* PRESERVED: Reasoning */}
                      <div className="border-t border-slate-600/30 pt-3">
                        <p className="text-xs font-medium text-slate-400 mb-1">REASONING:</p>
                        <p className="text-slate-300 text-sm">{suggestion.reasoning}</p>

                        {suggestion.lineReference && (
                          <p className="text-xs text-slate-500 mt-2">
                            Reference: {suggestion.lineReference}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!isLoading && !error && suggestions.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Lightbulb className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                <p className="text-white font-medium mb-2">No Suggestions Available</p>
                <p className="text-slate-400 text-sm">
                  The current feedback doesn't contain specific areas for improvement.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* PRESERVED: Footer */}
        {!isLoading && !error && suggestions.length > 0 && (
          <div className="p-4 bg-slate-900 border-t border-slate-700 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span>
                Enhanced writer suggestions • {isBlended ? 'Blended mentor insights' : `${mentorName}'s expertise`}
              </span>
              <span>
                Generated: {new Date().toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RewriteSuggestions;