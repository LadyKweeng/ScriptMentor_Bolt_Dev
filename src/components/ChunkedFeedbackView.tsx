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
  Sparkles,
  Coins,
  ArrowDown,
} from 'lucide-react';
import { backendApiService } from '../services/backendApiService';

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
  onShowWriterSuggestions?: () => void;  // Add this new prop
  selectedChunkId?: string | null; // NEW: Add selected chunk ID
}

type ViewMode = 'overview' | 'structured' | 'scratchpad';

// NEW: Get display title for selected chunk
const getSelectedChunkTitle = (chunks: any[], selectedChunkId: string | null): string => {
  if (!selectedChunkId || !chunks) return '';
  
  const chunkIndex = chunks.findIndex(c => c.chunkId === selectedChunkId);
  if (chunkIndex === -1) return '';
  
  const chunk = chunks[chunkIndex];
  
  // Use actual page numbers if available
  if (chunk.startPage && chunk.endPage) {
    return `Pages ${chunk.startPage}-${chunk.endPage} (Section ${chunkIndex + 1})`;
  }
  
  // Fallback: estimate pages based on position
  const avgPagesPerChunk = 15;
  const startPage = (chunkIndex * avgPagesPerChunk) + 1;
  const endPage = startPage + avgPagesPerChunk - 1;
  return `Pages ${startPage}-${endPage} (Section ${chunkIndex + 1})`;
};

const ChunkedFeedbackView: React.FC<ChunkedFeedbackViewProps> = ({
  chunkedFeedback,
  mentor,
  feedbackMode = 'structured',
  onModeChange,
  onShowWriterSuggestions,
  selectedChunkId // NEW: Add this parameter
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [copiedItem, setCopiedItem] = useState<string>('');
  const [overviewContent, setOverviewContent] = useState<string>('');
  const [isGeneratingOverview, setIsGeneratingOverview] = useState(false);

  // Enhanced blended feedback detection
  const isBlended = mentor.id === 'blended';

  // MINIMAL FIX: Only sync when feedbackMode actually changes and avoid the infinite loop
  useEffect(() => {
    console.log('📋 feedbackMode prop changed:', feedbackMode);
    // Only sync if feedbackMode is different from current viewMode and not overview
    if (feedbackMode && feedbackMode !== viewMode && viewMode !== 'overview') {
      console.log('🔄 Syncing with parent feedbackMode:', feedbackMode);
      setViewMode(feedbackMode);
    }
  }, [feedbackMode]); // Don't include viewMode in dependencies

  // Generate AI overview when needed
  useEffect(() => {
    if (viewMode === 'overview' && !overviewContent) {
      generateOverview();
    }
  }, [chunkedFeedback.id, viewMode]);

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

  // Generate AI overview based on chunked feedback
  const generateOverview = async () => {
    try {
      setIsGeneratingOverview(true);
      
      // Get content from summary and a sample of chunks
      const summary = chunkedFeedback.summary || {};
      const chunks = chunkedFeedback.chunks || [];
      
      // Get a sample of chunk content (first, middle, last)
      const sampleChunks = [];
      if (chunks.length > 0) sampleChunks.push(chunks[0]);
      if (chunks.length > 2) sampleChunks.push(chunks[Math.floor(chunks.length / 2)]);
      if (chunks.length > 1) sampleChunks.push(chunks[chunks.length - 1]);
      
      // Create prompt for AI to generate overview
      const prompt = `
You are ${mentor.name}, a screenplay mentor with the following style:
"${mentor.tone}"

You've provided feedback on a chunked screenplay with ${chunks.length} sections. Based on your feedback, create a concise overview summary.

The feedback summary includes:
${summary.overallStructure || ''}

Key strengths identified:
${summary.keyStrengths?.join('\n') || 'No key strengths identified.'}

Major issues identified:
${summary.majorIssues?.join('\n') || 'No major issues identified.'}

Sample feedback from sections:
${sampleChunks.map(chunk => `
SECTION: ${chunk.chunkTitle}
${chunk.structuredContent?.substring(0, 300)}...
`).join('\n')}

Write a 3-paragraph overview (2-3 sentences each) that summarizes your key insights about this screenplay.
- Use your unique voice and perspective as ${mentor.name}
- Focus on the most important points from the overall analysis
- Maintain your specific mentoring style and tone
- Write in paragraph form (not bullet points)
- Be specific about the screenplay's strengths and weaknesses
- End with your overall assessment and most important recommendation

Your overview should sound like it was written by you personally, not generated.
`;

      try {
        // Use backendApiService to generate the overview
        const overview = await backendApiService.generateAnalysis({
          prompt,
          analysisType: 'overview',
          model: 'gpt-4o-mini',
          temperature: 0.7
        });
        
        if (overview) {
          setOverviewContent(overview);
        } else {
          // Fallback if API fails
          setOverviewContent(generateFallbackOverview(chunkedFeedback, mentor));
        }
      } catch (error) {
        console.error('Failed to generate AI overview:', error);
        setOverviewContent(generateFallbackOverview(chunkedFeedback, mentor));
      }
    } finally {
      setIsGeneratingOverview(false);
    }
  };

  // Generate a fallback overview if AI generation fails
  const generateFallbackOverview = (chunkedFeedback: ChunkedScriptFeedback, mentor: any): string => {
    const isBlended = mentor.id === 'blended';
    const summary = chunkedFeedback.summary || {};
    
    let overview = '';
    
    if (isBlended) {
      overview = `This script presents a blend of strengths and challenges when viewed through multiple mentoring perspectives. The structure shows potential but requires refinement to fully realize its dramatic potential across all ${chunkedFeedback.chunks?.length || 0} sections. The character work contains promising elements that could be enhanced through more specific choices and clearer objectives throughout the narrative.\n\n`;
      
      overview += `From a dialogue perspective, there are moments of authenticity mixed with areas that need more subtext and purpose. The pacing varies throughout, with some sections moving effectively while others could benefit from tightening or expansion to better serve the story's rhythm. These observations represent a consensus across different mentoring approaches applied to the full script.\n\n`;
      
      overview += `Overall, this script demonstrates promise that can be fully realized through targeted revisions. By addressing the structural and character issues identified across multiple perspectives, while preserving the existing strengths, the screenplay can achieve a more compelling and cohesive form. The most critical next step is to ensure every scene serves the central dramatic engine while maintaining authentic character psychology.`;
    } else {
      switch (mentor.id) {
        case 'tony-gilroy':
          overview = `This ${chunkedFeedback.chunks?.length || 0}-section script needs a clearer engine driving the narrative forward. The structure has potential but lacks the surgical precision needed to maintain momentum and purpose across all sections. Every scene must earn its place by advancing plot or revealing character in ways that feel inevitable yet surprising.\n\n`;
          
          overview += `The dialogue occasionally works but often falls into exposition or fails to reveal character through conflict. Look for opportunities to cut unnecessary exchanges and ensure every line serves multiple purposes - advancing story while revealing character simultaneously. The real drama often lies beneath the surface of what's being said.\n\n`;
          
          overview += `Overall, this screenplay requires a ruthless examination of what's essential versus what's merely interesting. Cut anything that doesn't directly serve your story engine, clarify character objectives in every scene, and ensure each moment creates inevitable momentum toward your conclusion. Remember: if nothing breaks when you remove a scene, it doesn't belong in your script.`;
          break;
          
        case 'sofia-coppola':
          overview = `This ${chunkedFeedback.chunks?.length || 0}-section screenplay has moments of emotional authenticity that deserve to be amplified. The atmosphere and mood show potential, but could be more consistently developed to reflect the internal landscapes of your characters. There's room to trust silence and visual storytelling more deeply throughout the narrative.\n\n`;
          
          overview += `Your character work contains promising elements, though the emotional truth sometimes gets buried under exposition. Look for opportunities to reveal feelings through behavior rather than dialogue, and trust that small, specific details often carry more emotional weight than explanations. The most powerful moments are often found in what remains unsaid.\n\n`;
          
          overview += `Overall, this script would benefit from a greater confidence in subtext and atmospheric detail. Focus on creating moments where environment and character psychology merge, where gestures reveal more than words, and where the audience is trusted to feel rather than be told. Remember that the truth lives in what isn't said - in the spaces between words.`;
          break;
          
        case 'vince-gilligan':
          overview = `This ${chunkedFeedback.chunks?.length || 0}-section screenplay shows potential in its character foundations, though the psychological depth could be more consistently developed. The choices characters make sometimes feel driven by plot necessity rather than emerging organically from established traits and flaws. Every decision should feel both surprising and inevitable.\n\n`;
          
          overview += `The moral complexity of your story has interesting dimensions that could be further explored. Look for opportunities to place characters in situations where there are no clear right answers, where their core values come into conflict with their immediate needs. These impossible choices reveal character truth in ways that simple obstacles cannot.\n\n`;
          
          overview += `Overall, this script would benefit from a deeper exploration of how character psychology drives plot, rather than the reverse. Ensure that each character's actions emerge from their specific flaws and desires, creating consequences that feel both unexpected and unavoidable. Remember that character is plot - what would this specific person actually do in this impossible situation?`;
          break;
          
        case 'amy-pascal':
          overview = `This ${chunkedFeedback.chunks?.length || 0}-section screenplay has elements that audiences could connect with, though the emotional stakes need to be more consistently clear and relatable. The characters show potential, but their journeys would resonate more deeply if grounded in universal human experiences that viewers can immediately recognize and feel.\n\n`;
          
          overview += `The script balances artistic elements with commercial appeal, though this balance could be more consistent throughout. Look for opportunities to maintain your unique voice while ensuring the audience always understands what's at stake emotionally for your characters. The most successful stories combine artistic integrity with broad human connection.\n\n`;
          
          overview += `Overall, this screenplay would benefit from a sharper focus on making us care about these specific characters and their journey. Ensure that beneath the plot mechanics lies a recognizable emotional truth that resonates across different audiences. Remember that great scripts make you forget you're reading - they make you care.`;
          break;
          
        default:
          overview = `This ${chunkedFeedback.chunks?.length || 0}-section screenplay shows both strengths and areas for development. The structure has promising elements but could be more consistently focused on driving the central narrative forward. Character motivations are sometimes clear but would benefit from more specific objectives and obstacles throughout.\n\n`;
          
          overview += `The dialogue contains effective moments mixed with areas that could be more efficient and purposeful. Look for opportunities to reveal character through subtext rather than exposition, and ensure each exchange serves multiple dramatic functions. The pacing varies throughout, with some sections moving effectively while others could be tightened.\n\n`;
          
          overview += `Overall, this script demonstrates potential that can be realized through targeted revisions. Focus on clarifying the central dramatic question, ensuring character choices emerge from established traits, and maintaining consistent momentum throughout. With these adjustments, the screenplay will achieve a more compelling and cohesive form.`;
      }
    }
    
    return overview;
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

  return (
    <div 
      className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 h-[calc(100vh-16rem)] flex flex-col"
      style={{ boxShadow: `0 4px 12px ${mentor.accent}20` }}
    >
      {/* Enhanced Header with Blended Feedback Support */}
      <div
        className="p-3 sm:p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between flex-shrink-0 min-w-0"
        style={{ borderBottom: `2px solid ${mentor.accent}` }}
      >
        {/* Left Section - Mentor Info */}
        <div className="flex items-center min-w-0 flex-shrink-0 max-w-xs lg:max-w-none">
          <img
            src={mentor.avatar}
            alt={mentor.name}
            className="w-10 h-10 rounded-full object-cover mr-3 border-2 flex-shrink-0"
            style={{ borderColor: mentor.accent }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white truncate">{mentor.name}</h3>
            </div>
            <p className="text-xs text-slate-400 italic truncate">
              <span className="hidden lg:inline">{mentor.tone}</span>
              <span className="lg:hidden">
                {mentor.tone.length > 20 ? mentor.tone.substring(0, 20) + '...' : mentor.tone}
              </span>
            </p>
          </div>
        </div>

        {/* Center Section - Error/Warning Stats Only */}
        <div className="flex items-center gap-1 sm:gap-2 mx-1 sm:mx-2 md:mx-4 flex-1 justify-center overflow-hidden">
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

        {/* Right Section - View Mode Toggle */}
        <div className="flex bg-slate-700 rounded-lg p-0.5 flex-shrink-0 min-w-0">
          <button
            type="button"
            onClick={() => handleViewModeChange('overview')}
            className={`flex items-center justify-center px-1.5 md:px-2 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'overview'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-600'
              }`}
            title="Overview"
          >
            <Eye className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
            <span className="hidden lg:inline ml-1">Overview</span>
          </button>

          <button
            type="button"
            onClick={() => handleViewModeChange('structured')}
            className={`flex items-center justify-center px-1.5 md:px-2 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'structured'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-600'
              }`}
            title="Structured"
          >
            <MessageSquare className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
            <span className="hidden lg:inline ml-1">Structured</span>
          </button>

          <button
            type="button"
            onClick={() => handleViewModeChange('scratchpad')}
            className={`flex items-center justify-center px-1.5 md:px-2 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'scratchpad'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-600'
              }`}
            title="Scratchpad"
          >
            <Lightbulb className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
            <span className="hidden lg:inline ml-1">Scratchpad</span>
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

              {/* AI-Generated Overview */}
              <div className="bg-slate-700/20 rounded-lg p-4 border border-slate-600/30 mb-6">
                <h4 className="text-sm font-semibold text-yellow-400 mb-3">
                  {isBlended ? 'Multi-Mentor Analysis Summary' : `${mentor.name}'s Analysis Summary`}
                </h4>
                <div className="text-slate-300 text-sm leading-relaxed">
                  {isGeneratingOverview ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-yellow-400 mr-2"></div>
                      <span>Generating overview...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {overviewContent ? (
                        overviewContent.split('\n\n').map((paragraph, index) => (
                          <p key={index} className="text-slate-300">{paragraph}</p>
                        ))
                      ) : (
                        <p className="text-slate-400 italic">Overview generation failed. Please try again.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Structural Assessment */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-purple-400" />
                  <span className="font-medium text-purple-400">
                    {isBlended ? 'Multi-Perspective Structural Foundation' : 'Structural Foundation'}
                  </span>
                </div>
                <p className="text-slate-300 mb-3">
                  {chunkedFeedback.summary?.overallStructure || 'Analysis unavailable.'}
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

              {/* Enhanced Writer Suggestions Section */}
              <div className="mt-6 pt-4 border-t border-slate-600/30">
                <div className="bg-slate-700/20 rounded-lg p-4 border border-slate-600/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-yellow-400" />
                      <div>
                        <h4 className="font-medium text-white">Enhanced Writer Suggestions</h4>
                        <p className="text-sm text-slate-400">
                          Concrete before/after examples with {isBlended ? 'blended mentor' : 'mentor'} guidance
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Page/Section Info Badge */}
                      {selectedChunkId && (
                        <div className="flex items-center gap-2 text-sm bg-blue-600/20 text-blue-400 px-3 py-2 rounded-lg border border-blue-500/30">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium">
                            {getSelectedChunkTitle(chunkedFeedback.chunks || [], selectedChunkId)}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={onShowWriterSuggestions}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm font-medium transition-all"
                          type="button"
                        >
                          <Sparkles className="h-4 w-4" />
                          View Suggestions
                        </button>

                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Coins className="h-3 w-3" />
                          <span>8 tokens</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">30-45 seconds</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <ArrowDown className="h-3 w-3" />
                    <span>
                      Click above to see your personalized rewrite suggestions{isBlended ? ' from blended mentors' : ''}!
                    </span>
                  </div>
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
                      {/* Enhanced Chunk Header with Status */}
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

        {/* Enhanced Global Recommendations Footer with Blended Support */}
        {chunkedFeedback.summary?.globalRecommendations && chunkedFeedback.summary.globalRecommendations.length > 0 && (
          <div className="p-4 bg-slate-700/30 border-t border-slate-600/50 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-purple-400" />
              <h4 className="font-medium text-white text-sm">
                {isBlended ? 'Blended Mentoring Recommendations' : `${mentor.name}'s Overall Recommendations`}
              </h4>
            </div>
            <div className="space-y-2">
              {chunkedFeedback.summary.globalRecommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0"></div>
                  <p className="text-slate-300 text-sm">{rec}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-600/30 text-center">
              <p className="text-sm text-yellow-400 italic">
                "{mentor.mantra || 'Every word must earn its place on the page.'}"
              </p>
              <p className="text-xs text-slate-400 mt-1">
                — {isBlended ? 'Blended Mentoring Philosophy' : mentor.name}
              </p>
            </div>
          </div>
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