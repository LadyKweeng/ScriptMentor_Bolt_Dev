import React, { useState, useEffect } from 'react';
import { ChunkedScriptFeedback, Mentor, FeedbackMode, ChunkFeedback } from '../types';
import { 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  MessageSquare, 
  Lightbulb,
  ClipboardCopy,
  BookOpen,
  BarChart3,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Target,
  Eye,
  Users,
  Zap,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';

interface ChunkedFeedbackViewProps {
  chunkedFeedback: ChunkedScriptFeedback;
  mentor: Mentor | {
    id: string;
    name: string;
    tone: string;
    styleNotes: string;
    avatar: string;
    accent: string;
    mantra?: string;
  };
  feedbackMode?: FeedbackMode;
  onModeChange?: (mode: FeedbackMode) => void;
}

type ViewMode = 'overview' | 'structured' | 'scratchpad';

const ChunkedFeedbackView: React.FC<ChunkedFeedbackViewProps> = ({
  chunkedFeedback,
  mentor,
  feedbackMode = 'structured',
  onModeChange
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [copiedItem, setCopiedItem] = useState<string>('');

  // Enhanced blended feedback detection
  const isBlended = mentor.id === 'blended';

  useEffect(() => {
    console.log('📋 View mode updated:', viewMode);
    // Only update view mode if it's not overview and feedbackMode changes
    if (viewMode !== 'overview' && feedbackMode && feedbackMode !== viewMode) {
      console.log('🔄 Syncing with parent feedbackMode:', feedbackMode);
      setViewMode(feedbackMode);
    }
  }, [feedbackMode]); // Remove viewMode from dependencies to prevent infinite loop

  const handleViewModeChange = (mode: ViewMode) => {
    console.log('🔄 Switching view mode:', { from: viewMode, to: mode });
    setViewMode(mode);
    if (mode !== 'overview' && onModeChange) {
      onModeChange(mode as FeedbackMode);
    }
  };

  const toggleChunk = (chunkId: string) => {
    const newExpanded = new Set(expandedChunks);
    if (newExpanded.has(chunkId)) {
      newExpanded.delete(chunkId);
    } else {
      newExpanded.add(chunkId);
    }
    setExpandedChunks(newExpanded);
  };

  const expandAll = () => {
    const chunks = chunkedFeedback.chunks || [];
    setExpandedChunks(new Set(chunks.map(chunk => chunk.chunkId)));
  };

  const collapseAll = () => {
    setExpandedChunks(new Set());
  };

  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(itemId);
      setTimeout(() => setCopiedItem(''), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyAllFeedback = () => {
    const chunks = chunkedFeedback.chunks || [];
    const allContent = chunks.map(chunk => {
      const content = viewMode === 'scratchpad' ? 
        (chunk.scratchpadContent || '') : 
        (chunk.structuredContent || '');
      return `=== ${chunk.chunkTitle || 'Untitled Chunk'} ===\n\n${content}\n\n`;
    }).join('');
    
    copyToClipboard(allContent, 'all');
  };

  const getCurrentContent = (chunk: ChunkFeedback): string => {
    const content = viewMode === 'scratchpad' ? chunk.scratchpadContent : chunk.structuredContent;
    return content || 'No content available for this section.';
  };

  // Enhanced chunk status detection with blended feedback support
  const getChunkStatusInfo = (chunk: any) => {
    if ((chunk as any).processingError) {
      const errorType = (chunk as any).processingError;
      return {
        status: 'error' as const,
        icon: AlertTriangle,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/20',
        message: errorType === 'rate limit' ? 'Rate limited - retry later' : 
                 errorType === 'blending failed' ? 'Blending failed - manual review needed' :
                 errorType === 'token limit' ? 'Content too large for processing' :
                 'Processing failed'
      };
    }
    
    return {
      status: 'success' as const,
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      message: isBlended ? 'Blended analysis complete' : 'Analysis complete'
    };
  };

  // Enhanced stats calculation with blended feedback support
  const getChunkStats = () => {
    const total = chunkedFeedback.chunks?.length || 0;
    const successful = chunkedFeedback.chunks?.filter(chunk => 
      !(chunk as any).processingError
    ).length || 0;
    const rateLimited = chunkedFeedback.chunks?.filter(chunk => 
      (chunk as any).processingError === 'rate limit'
    ).length || 0;
    const blendingFailed = chunkedFeedback.chunks?.filter(chunk => 
      (chunk as any).processingError === 'blending failed'
    ).length || 0;
    const tokenLimited = chunkedFeedback.chunks?.filter(chunk => 
      (chunk as any).processingError === 'token limit'
    ).length || 0;
    const otherFailed = total - successful - rateLimited - blendingFailed - tokenLimited;

    return { total, successful, rateLimited, blendingFailed, tokenLimited, otherFailed };
  };

  const stats = getChunkStats();

  // Generate comprehensive script overview
  const generateScriptOverview = () => {
    const chunks = chunkedFeedback?.chunks || [];
    const summary = chunkedFeedback?.summary;
    
    if (chunks.length === 0) {
      return {
        structuralAnalysis: { assessment: "No chunks available for analysis.", recommendation: "Please ensure script is properly processed." },
        characterAnalysis: { assessment: "No chunks available for analysis.", recommendation: "Please ensure script is properly processed." },
        dialogueAnalysis: { assessment: "No chunks available for analysis.", recommendation: "Please ensure script is properly processed." },
        pacingAnalysis: { assessment: "No chunks available for analysis.", recommendation: "Please ensure script is properly processed." },
        overallAssessment: "Script analysis unavailable. Please ensure the script has been properly processed."
      };
    }
    
    // Analyze script structure and flow with blended feedback awareness
    const structuralAnalysis = analyzeScriptStructure(chunks, isBlended);
    const characterAnalysis = analyzeCharacterPresence(chunks, isBlended);
    const dialogueAnalysis = analyzeDialoguePatterns(chunks, isBlended);
    const pacingAnalysis = analyzePacingFlow(chunks, isBlended);
    
    return {
      structuralAnalysis,
      characterAnalysis,
      dialogueAnalysis,
      pacingAnalysis,
      overallAssessment: generateOverallAssessment(chunks, summary, mentor, isBlended)
    };
  };

  const overview = generateScriptOverview();

  return (
    <div 
      className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 h-[calc(100vh-16rem)] flex flex-col"
      style={{ boxShadow: `0 4px 12px ${mentor.accent}20` }}
    >
      {/* Enhanced Header with Better Spacing and Responsive Design */}
      <div 
        className="p-3 sm:p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: `2px solid ${mentor.accent}` }}
      >
        {/* Left Section - Mentor Info */}
        <div className="flex items-center min-w-0 flex-1">
          <img 
            src={mentor.avatar} 
            alt={mentor.name} 
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover mr-2 sm:mr-3 border-2 flex-shrink-0"
            style={{ borderColor: mentor.accent }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white text-sm sm:text-base truncate">{mentor.name}</h3>
              {isBlended && (
                <span className="bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full text-xs font-medium border border-purple-500/30 flex items-center gap-1 flex-shrink-0">
                  <Users className="h-3 w-3" />
                  <span className="hidden sm:inline">Multi-Mentor</span>
                  <span className="sm:hidden">Multi</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center Section - Error/Warning Stats Only */}
        <div className="flex items-center gap-1 sm:gap-2 mx-2 sm:mx-4 flex-shrink-0">
          {stats.rateLimited > 0 && (
            <span className="bg-yellow-500/20 text-yellow-400 px-1.5 sm:px-2 py-1 rounded-full text-xs font-medium border border-yellow-500/30 whitespace-nowrap">
              <span className="hidden sm:inline">{stats.rateLimited} Rate Limited</span>
              <span className="sm:hidden">{stats.rateLimited}R</span>
            </span>
          )}

          {stats.blendingFailed > 0 && (
            <span className="bg-orange-500/20 text-orange-400 px-1.5 sm:px-2 py-1 rounded-full text-xs font-medium border border-orange-500/30 whitespace-nowrap">
              <span className="hidden sm:inline">{stats.blendingFailed} Blend Failed</span>
              <span className="sm:hidden">{stats.blendingFailed}B</span>
            </span>
          )}

          {stats.tokenLimited > 0 && (
            <span className="bg-red-500/20 text-red-400 px-1.5 sm:px-2 py-1 rounded-full text-xs font-medium border border-red-500/30 whitespace-nowrap">
              <span className="hidden sm:inline">{stats.tokenLimited} Too Large</span>
              <span className="sm:hidden">{stats.tokenLimited}L</span>
            </span>
          )}
        </div>

        {/* Right Section - View Mode Toggle - Fully Responsive */}
        <div className="flex bg-slate-700 rounded-lg p-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleViewModeChange('overview')}
            className={`flex items-center justify-center px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium transition-all min-w-0 ${
              viewMode === 'overview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-600'
            }`}
            title="Overview"
          >
            <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline ml-1 whitespace-nowrap">Overview</span>
          </button>

          <button
            type="button"
            onClick={() => handleViewModeChange('structured')}
            className={`flex items-center justify-center px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium transition-all min-w-0 ${
              viewMode === 'structured'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-600'
            }`}
            title="Structured"
          >
            <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline ml-1 whitespace-nowrap">Structured</span>
          </button>

          <button
            type="button"
            onClick={() => handleViewModeChange('scratchpad')}
            className={`flex items-center justify-center px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium transition-all min-w-0 ${
              viewMode === 'scratchpad'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-600'
            }`}
            title="Scratchpad"
          >
            <Lightbulb className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline ml-1 whitespace-nowrap">Scratchpad</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Enhanced Script Overview Content with Blended Support */}
        {viewMode === 'overview' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4 text-sm leading-relaxed">
              {/* Blended Analysis Indicator */}
              {isBlended && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span className="font-medium text-purple-400">Blended Analysis Overview</span>
                  </div>
                  <p className="text-purple-300 text-sm">
                    This analysis combines insights from multiple mentoring perspectives to provide comprehensive guidance across all script dimensions.
                  </p>
                </div>
              )}

              {/* Structural Assessment */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-purple-400" />
                  <span className="font-medium text-purple-400">
                    {isBlended ? 'Multi-Perspective Structural Foundation' : 'Structural Foundation'}
                  </span>
                </div>
                <p className="text-slate-300 mb-3">
                  {overview?.structuralAnalysis?.assessment || 'Analysis unavailable.'}
                </p>
                <p className="text-slate-300">
                  {overview?.structuralAnalysis?.recommendation || 'Please ensure script is properly processed.'}
                </p>
              </div>

              {/* Character Development */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-green-400" />
                  <span className="font-medium text-green-400">
                    {isBlended ? 'Multi-Mentor Character Development' : 'Character Development'}
                  </span>
                </div>
                <p className="text-slate-300 mb-3">
                  {overview?.characterAnalysis?.assessment || 'Analysis unavailable.'}
                </p>
                <p className="text-slate-300">
                  {overview?.characterAnalysis?.recommendation || 'Please ensure script is properly processed.'}
                </p>
              </div>

              {/* Dialogue & Voice */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-4 w-4 text-yellow-400" />
                  <span className="font-medium text-yellow-400">
                    {isBlended ? 'Blended Dialogue & Voice Analysis' : 'Dialogue & Voice'}
                  </span>
                </div>
                <p className="text-slate-300 mb-3">
                  {overview?.dialogueAnalysis?.assessment || 'Analysis unavailable.'}
                </p>
                <p className="text-slate-300">
                  {overview?.dialogueAnalysis?.recommendation || 'Please ensure script is properly processed.'}
                </p>
              </div>

              {/* Pacing & Flow */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-orange-400" />
                  <span className="font-medium text-orange-400">
                    {isBlended ? 'Multi-Perspective Pacing & Momentum' : 'Pacing & Momentum'}
                  </span>
                </div>
                <p className="text-slate-300 mb-3">
                  {overview?.pacingAnalysis?.assessment || 'Analysis unavailable.'}
                </p>
                <p className="text-slate-300">
                  {overview?.pacingAnalysis?.recommendation || 'Please ensure script is properly processed.'}
                </p>
              </div>

              {/* Overall Assessment */}
              <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 rounded-lg p-4 border border-slate-600/30">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4" style={{ color: mentor.accent }} />
                  <span className="font-medium" style={{ color: mentor.accent }}>
                    {isBlended ? 'Blended Mentoring Assessment' : `${mentor.name}'s Overall Assessment`}
                  </span>
                </div>
                <p className="text-slate-200 leading-relaxed">
                  {overview?.overallAssessment || 'Overall assessment unavailable. Please ensure script is properly processed.'}
                </p>
              </div>

              {/* Enhanced Strengths/Issues Grid with Blended Support */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-600/30">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    <span className="text-green-400 font-medium text-xs">
                      {isBlended ? 'Consensus Strengths' : 'Key Strengths'}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {chunkedFeedback.summary?.keyStrengths?.map((strength, index) => (
                      <li key={index} className="text-slate-300 text-xs">• {strength}</li>
                    )) || <li className="text-slate-400 text-xs italic">No strengths data available</li>}
                  </ul>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-3 w-3 text-orange-400" />
                    <span className="text-orange-400 font-medium text-xs">
                      {isBlended ? 'Priority Areas (Multi-Mentor)' : 'Priority Areas'}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {chunkedFeedback.summary?.majorIssues?.map((issue, index) => (
                      <li key={index} className="text-slate-300 text-xs">• {issue}</li>
                    )) || <li className="text-slate-400 text-xs italic">No issues data available</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Structured/Scratchpad Content with Error Handling */}
        {viewMode !== 'overview' && (
          <>
            {/* Chunk Controls */}
            <div className="p-3 bg-slate-700/20 border-b border-slate-600/30 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={expandAll}
                  className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
                >
                  <ChevronDown className="h-3 w-3" />
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
                >
                  <ChevronRight className="h-3 w-3" />
                  Collapse All
                </button>
                {isBlended && (
                  <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/30">
                    Blended Analysis
                  </span>
                )}
              </div>
              
              <button
                onClick={copyAllFeedback}
                className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
              >
                <ClipboardCopy className="h-3 w-3" />
                {copiedItem === 'all' ? 'Copied!' : 'Copy All'}
              </button>
            </div>

            {/* Enhanced Chunks List with Error Handling */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-2 p-4">
                {(chunkedFeedback.chunks || []).map((chunk, index) => {
                  const isExpanded = expandedChunks.has(chunk.chunkId);
                  const currentContent = getCurrentContent(chunk);
                  const statusInfo = getChunkStatusInfo(chunk);
                  
                  return (
                    <div key={chunk.chunkId} className="bg-slate-700/20 rounded-lg border border-slate-600/30">
                      {/* Enhanced Chunk Header with Status - REMOVED timestamps and word counts */}
                      <div className="w-full p-3 flex items-center justify-between hover:bg-slate-600/20 transition-colors">
                        <div
                          onClick={() => toggleChunk(chunk.chunkId)}
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}

                          <div className={`p-1 rounded ${statusInfo.bgColor} ${statusInfo.borderColor} border`}>
                            <statusInfo.icon className={`h-3 w-3 ${statusInfo.color}`} />
                          </div>

                          <div className="flex items-center gap-2">
                            {viewMode === 'scratchpad' ? (
                              <MessageSquare className="h-4 w-4 text-yellow-400" />
                            ) : (
                              <FileText className="h-4 w-4 text-blue-400" />
                            )}
                            <div className="text-left">
                              <span className="font-medium text-white">{chunk.chunkTitle || `Chunk ${index + 1}`}</span>
                              <div className="text-xs text-slate-400">
                                {statusInfo.message}
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-slate-500 bg-slate-600/50 px-2 py-1 rounded">
                            {index + 1} of {chunkedFeedback.chunks?.length || 0}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(currentContent || '', chunk.chunkId);
                            }}
                            className="p-1 text-slate-500 hover:text-slate-300"
                            title="Copy chunk feedback"
                          >
                            <ClipboardCopy className="h-3 w-3" />
                          </button>
                          {copiedItem === chunk.chunkId && (
                            <span className="text-xs text-green-400">Copied!</span>
                          )}
                        </div>
                      </div>

                      {/* Enhanced Chunk Content with Error Handling */}
                      {isExpanded && (
                        <div className="px-4 pb-4">
                          <div className="border-t border-slate-600/30 pt-4">
                            {statusInfo.status === 'error' ? (
                              <div className={`p-3 rounded ${statusInfo.bgColor} ${statusInfo.borderColor} border`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertTriangle className={`h-4 w-4 ${statusInfo.color}`} />
                                  <span className={`font-medium ${statusInfo.color}`}>
                                    {(chunk as any).processingError === 'blending failed' ? 'Blending Failed' : 
                                     (chunk as any).processingError === 'rate limit' ? 'Rate Limited' :
                                     (chunk as any).processingError === 'token limit' ? 'Content Too Large' :
                                     'Processing Issue'}
                                  </span>
                                </div>
                                <p className="text-slate-300 text-sm">
                                  {(chunk as any).errorDetails || statusInfo.message}
                                </p>
                                {(chunk as any).processingError === 'rate limit' && (
                                  <p className="text-slate-400 text-xs mt-2">
                                    This section can be reprocessed during off-peak hours when API limits are less restrictive.
                                  </p>
                                )}
                                {(chunk as any).processingError === 'blending failed' && (
                                  <p className="text-slate-400 text-xs mt-2">
                                    Individual mentor feedback may still be available. Consider single-mentor analysis for this section.
                                  </p>
                                )}
                                {(chunk as any).processingError === 'token limit' && (
                                  <p className="text-slate-400 text-xs mt-2">
                                    This section is too large for processing. Consider breaking it into smaller parts.
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {viewMode === 'scratchpad' ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2 mb-3">
                                      <Lightbulb className="h-4 w-4 text-yellow-400" />
                                      <span className="text-sm font-medium text-yellow-400">
                                        {isBlended ? 'Blended Scratchpad Notes' : 'Scratchpad Notes'}
                                      </span>
                                    </div>
                                    <div className="text-slate-300 text-sm leading-relaxed">
                                      {formatFeedbackText(currentContent || 'No content available')}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="text-slate-300 text-sm leading-relaxed">
                                      {formatFeedbackText(currentContent || 'No content available')}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Chunk-specific blended indicator */}
                                {isBlended && statusInfo.status === 'success' && (
                                  <div className="mt-4 pt-3 border-t border-slate-600">
                                    <div className="flex items-center gap-2 text-xs text-purple-400">
                                      <Sparkles className="h-3 w-3" />
                                      <span>This analysis combines insights from multiple mentoring perspectives</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Processing Stats Footer with Enhanced Blended Support */}
        {(chunkedFeedback as any).processingStats && (
          <div className="p-3 bg-slate-900 border-t border-slate-700 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span>
                Processing: {(chunkedFeedback as any).processingStats.successfulChunks}/{(chunkedFeedback as any).processingStats.totalChunks} successful
                {isBlended && ' (blended from multiple mentors)'}
                {stats.rateLimited > 0 && `, ${stats.rateLimited} rate limited`}
                {stats.blendingFailed > 0 && `, ${stats.blendingFailed} blending failed`}
              </span>
              <span>
                Generated: {new Date(chunkedFeedback.timestamp).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced analysis helper functions with blended feedback support
const analyzeScriptStructure = (chunks: ChunkFeedback[], isBlended: boolean = false) => {
  if (!chunks || chunks.length === 0) {
    return {
      assessment: "Script structure analysis unavailable due to missing chunk data.",
      recommendation: "Please ensure the script has been properly processed for detailed structural analysis."
    };
  }

  const successfulChunks = chunks.filter(chunk => !(chunk as any).processingError);
  const hasStructuralIssues = successfulChunks.some(chunk => 
    chunk?.structuredContent?.toLowerCase().includes('structure') && 
    (chunk.structuredContent.toLowerCase().includes('weak') || chunk.structuredContent.toLowerCase().includes('unclear'))
  );

  const structuralStrengths = successfulChunks.filter(chunk => 
    chunk?.structuredContent?.toLowerCase().includes('structure') && 
    (chunk.structuredContent.toLowerCase().includes('strong') || chunk.structuredContent.toLowerCase().includes('well'))
  ).length;

  const blendedPrefix = isBlended ? "Blended mentor analysis reveals that " : "";
  const blendedContext = isBlended ? " from multiple mentoring perspectives" : "";

  if (structuralStrengths > successfulChunks.length / 2) {
    return {
      assessment: `${blendedPrefix}the script demonstrates solid structural foundations across most sections. The narrative architecture supports the story effectively${blendedContext}, with clear scene purposes and logical progression. Each section contributes meaningfully to the overall dramatic arc.`,
      recommendation: `Continue to maintain this structural integrity while looking for opportunities to further tighten connections between sections and enhance the overall story engine${isBlended ? ', considering insights from all mentoring approaches' : ''}.`
    };
  } else if (hasStructuralIssues) {
    return {
      assessment: `${blendedPrefix}the script shows structural inconsistencies that may weaken the overall narrative impact. Some sections lack clear purpose or connection to the central story engine, creating potential pacing and clarity issues${blendedContext}.`,
      recommendation: `Focus on clarifying each section's role in the larger story${blendedContext}. Ensure every scene advances plot, reveals character, or builds toward key story moments. Consider restructuring or combining sections that feel disconnected.`
    };
  } else {
    return {
      assessment: `${blendedPrefix}the script's structure is functional but has room for enhancement. While the basic narrative framework is present, the connections between sections could be strengthened${blendedContext} to create a more compelling dramatic throughline.`,
      recommendation: `Review the story spine to ensure each section builds momentum toward key dramatic beats${isBlended ? ', incorporating diverse mentoring insights' : ''}. Look for opportunities to create stronger cause-and-effect relationships between scenes.`
    };
  }
};

const analyzeCharacterPresence = (chunks: ChunkFeedback[], isBlended: boolean = false) => {
  if (!chunks || chunks.length === 0) {
    return {
      assessment: "Character analysis unavailable due to missing chunk data.",
      recommendation: "Please ensure the script has been properly processed for character analysis."
    };
  }

  const successfulChunks = chunks.filter(chunk => !(chunk as any).processingError);
  const characterConsistency = successfulChunks.filter(chunk => 
    chunk?.structuredContent?.toLowerCase().includes('character') && 
    chunk.structuredContent.toLowerCase().includes('consistent')
  ).length;

  const blendedPrefix = isBlended ? "Multi-mentor character analysis shows " : "";
  const blendedContext = isBlended ? " across different mentoring perspectives" : "";

  if (characterConsistency > successfulChunks.length / 3) {
    return {
      assessment: `${blendedPrefix}character development shows strong consistency across sections. Characters maintain distinct voices and clear motivations that drive their actions throughout the script${blendedContext}. The character arcs are well-established and support the central narrative.`,
      recommendation: `Continue developing the subtle character moments and relationship dynamics${isBlended ? ', leveraging insights from multiple mentoring approaches' : ''}. Look for opportunities to deepen character complexity through subtext and behavior rather than exposition.`
    };
  } else {
    return {
      assessment: `${blendedPrefix}character development varies across sections, with some characters feeling more fully realized than others. There are opportunities to strengthen character consistency${blendedContext} and ensure each character serves a clear dramatic function throughout the script.`,
      recommendation: `Audit each character's journey across all sections${blendedContext}. Ensure they have clear, active objectives in every scene and that their choices reflect established character traits and growth patterns.`
    };
  }
};

const analyzeDialoguePatterns = (chunks: ChunkFeedback[], isBlended: boolean = false) => {
  if (!chunks || chunks.length === 0) {
    return {
      assessment: "Dialogue analysis unavailable due to missing chunk data.",
      recommendation: "Please ensure the script has been properly processed for dialogue analysis."
    };
  }

  const successfulChunks = chunks.filter(chunk => !(chunk as any).processingError);
  const dialogueStrengths = successfulChunks.filter(chunk => 
    chunk?.structuredContent?.toLowerCase().includes('dialogue') && 
    (chunk.structuredContent.toLowerCase().includes('strong') || chunk.structuredContent.toLowerCase().includes('effective'))
  ).length;

  const dialogueIssues = successfulChunks.filter(chunk => 
    chunk?.structuredContent?.toLowerCase().includes('dialogue') && 
    (chunk.structuredContent.toLowerCase().includes('weak') || chunk.structuredContent.toLowerCase().includes('needs'))
  ).length;

  const blendedPrefix = isBlended ? "Blended dialogue analysis reveals " : "";
  const blendedContext = isBlended ? " from multiple mentoring viewpoints" : "";

  if (dialogueStrengths > dialogueIssues) {
    return {
      assessment: `${blendedPrefix}the dialogue demonstrates strong craft across most sections. Characters speak with distinct voices that reveal personality and advance the story efficiently${blendedContext}. The dialogue feels natural while serving multiple dramatic purposes simultaneously.`,
      recommendation: `Continue refining the dialogue's subtext and ensuring every exchange serves story and character goals${isBlended ? ', incorporating diverse mentoring insights on dialogue craft' : ''}. Look for opportunities to let characters communicate through behavior as much as words.`
    };
  } else {
    return {
      assessment: `${blendedPrefix}dialogue quality varies throughout the script, with some sections feeling more natural and purposeful than others. There are opportunities to strengthen character voice distinction${blendedContext} and ensure dialogue serves multiple story functions.`,
      recommendation: `Focus on making each character's speech patterns unique and ensuring dialogue advances plot, reveals character, or builds conflict${blendedContext}. Eliminate purely expository exchanges in favor of more organic character interactions.`
    };
  }
};

const analyzePacingFlow = (chunks: ChunkFeedback[], isBlended: boolean = false) => {
  if (!chunks || chunks.length === 0) {
    return {
      assessment: "Pacing analysis unavailable due to missing chunk data.",
      recommendation: "Please ensure the script has been properly processed for pacing analysis."
    };
  }

  const successfulChunks = chunks.filter(chunk => !(chunk as any).processingError);
  const pacingIssues = successfulChunks.filter(chunk => 
    chunk?.structuredContent?.toLowerCase().includes('pacing') && 
    (chunk.structuredContent.toLowerCase().includes('slow') || chunk.structuredContent.toLowerCase().includes('rushed'))
  ).length;

  const blendedPrefix = isBlended ? "Multi-perspective pacing analysis shows " : "";
  const blendedContext = isBlended ? " across different mentoring approaches" : "";

  if (pacingIssues < successfulChunks.length / 4) {
    return {
      assessment: `${blendedPrefix}the script maintains strong pacing throughout most sections. Scenes start efficiently, build appropriate tension, and conclude with forward momentum${blendedContext}. The rhythm varies appropriately to support different dramatic moments.`,
      recommendation: `Fine-tune the pacing variations to enhance the emotional journey${isBlended ? ', considering insights from multiple mentoring styles' : ''}. Consider how scene length and intensity create the overall reading experience and audience engagement.`
    };
  } else {
    return {
      assessment: `${blendedPrefix}pacing shows inconsistencies across sections that may impact reader engagement and story flow${blendedContext}. Some sections feel rushed while others lag, creating an uneven dramatic rhythm that could weaken overall script impact.`,
      recommendation: `Review each section's pacing in context of the larger story${blendedContext}. Ensure scenes start as late as possible and end with compelling hooks. Balance action with reflection to create an engaging dramatic rhythm.`
    };
  }
};

const generateOverallAssessment = (chunks: ChunkFeedback[], summary: any, mentor: any, isBlended: boolean = false) => {
  const sectionsCount = chunks?.length || 0;
  const successfulCount = chunks?.filter(chunk => !(chunk as any).processingError).length || 0;
  const mentorName = mentor?.name || 'Unknown Mentor';
  
  if (sectionsCount === 0) {
    return "Script analysis is incomplete. Please ensure all sections have been properly processed to generate a comprehensive assessment.";
  }

  if (isBlended) {
    return `This ${sectionsCount}-section script analysis combines insights from multiple mentoring perspectives to provide comprehensive guidance. With ${successfulCount} sections successfully analyzed, the blended approach reveals both consensus strengths and diverse viewpoints on areas for improvement. The multi-mentor analysis shows promise in the script's foundation while identifying specific opportunities for enhancement across structure, character development, dialogue craft, and pacing flow. This comprehensive perspective offers writers the benefit of diverse mentoring approaches, allowing for more nuanced and complete script development.`;
  }
  
  // Mentor-specific assessment style (keeping existing logic)
  switch (mentor?.id) {
    case 'tony-gilroy':
      return `This ${sectionsCount}-section script shows promise but needs focused attention on its story engine. The core dramatic spine needs strengthening to ensure every scene serves the central narrative drive. While individual moments may work, the overall machinery of story could be more efficient. Cut what doesn't serve the engine, clarify character objectives, and ensure each section builds inevitable momentum toward your story's destination.`;
    
    case 'sofia-coppola':
      return `Across these ${sectionsCount} sections, there's an opportunity to trust more in the emotional authenticity and atmospheric details that make stories resonate. The script has moments of genuine feeling, but could benefit from more confidence in subtext and silence. Focus on the internal landscapes of your characters and let the environment reflect their psychological states. The most powerful moments often happen between the lines.`;
    
    case 'vince-gilligan':
      return `This ${sectionsCount}-section analysis reveals a script with potential that needs deeper exploration of character psychology and consequence. The foundation is there, but the character choices need more psychological truth and inevitable outcomes. Every decision should feel both surprising and absolutely right for these specific characters. Build the moral complexity that makes audiences wrestle with right and wrong.`;
    
    case 'amy-pascal':
      return `Looking at these ${sectionsCount} sections, the script needs stronger audience connection points and clearer emotional stakes. While the story elements are present, the universal human truths need to shine through more clearly. Focus on making the audience care deeply about these characters by finding the relatable struggles beneath the specific circumstances. The emotional journey is what will make this script memorable.`;
    
    default:
      return `This ${sectionsCount}-section script analysis reveals both strengths and opportunities for development. The foundation shows solid craft, but the execution needs refinement across character development, dialogue efficiency, and structural clarity. Focus on serving the story's central purpose while ensuring each section contributes meaningfully to the overall dramatic arc. With targeted revisions, this script can achieve its full potential.`;
  }
};

// Helper function to format feedback text (keeping existing functionality)
const formatFeedbackText = (text: string): JSX.Element[] => {
  if (!text || text.trim() === '') {
    return [
      <div key="empty" className="text-slate-400 italic">
        No content available.
      </div>
    ];
  }

  const lines = text.split('\n').filter(line => line.trim());
  const formattedElements: JSX.Element[] = [];
  let currentSection = '';
  let sectionPoints: string[] = [];
  let elementKey = 0;

  const flushSection = () => {
    if (currentSection && sectionPoints.length > 0) {
      formattedElements.push(
        <div key={`section-${elementKey++}`} className="mb-6">
          <h4 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center">
            {currentSection.replace(/[*#]/g, '').trim()}
          </h4>
          <div className="space-y-3">
            {sectionPoints.map((point, idx) => (
              <div key={`point-${elementKey}-${idx}`} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 flex-shrink-0"></div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {formatInlineText(point)}
                </p>
              </div>
            ))}
          </div>
        </div>
      );
      sectionPoints = [];
    }
  };

  const formatInlineText = (text: string): JSX.Element => {
    const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*)/g);
    
    return (
      <span>
        {parts.map((part, idx) => {
          if (part.startsWith('***') && part.endsWith('***')) {
            return <strong key={idx} className="font-semibold text-white">{part.slice(3, -3)}</strong>;
          } else if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={idx} className="font-medium text-white">{part.slice(2, -2)}</strong>;
          }
          return <span key={idx}>{part}</span>;
        })}
      </span>
    );
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) continue;
    
    if (trimmedLine.match(/^#{2,4}\s/)) {
      flushSection();
      currentSection = trimmedLine.replace(/^#{2,4}\s/, '').replace(/:/g, '');
      continue;
    }
    
    const numberedMatch = trimmedLine.match(/^\d+\.\s*(.+)/);
    if (numberedMatch) {
      sectionPoints.push(numberedMatch[1]);
      continue;
    }
    
    const starredMatch = trimmedLine.match(/^\*\*([^*]+)\*\*:\s*(.+)/);
    if (starredMatch) {
      sectionPoints.push(`**${starredMatch[1]}**: ${starredMatch[2]}`);
      continue;
    }
    
    if (currentSection) {
      sectionPoints.push(trimmedLine);
    } else {
      formattedElements.push(
        <p key={`para-${elementKey++}`} className="text-slate-300 text-sm leading-relaxed mb-4">
          {formatInlineText(trimmedLine)}
        </p>
      );
    }
  }
  
  flushSection();
  
  return formattedElements;
};

export default ChunkedFeedbackView;