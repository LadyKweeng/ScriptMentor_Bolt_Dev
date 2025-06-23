// src/components/FeedbackView.tsx - Single scene feedback matching chunked style exactly
import React, { useState, useEffect } from 'react';
import { Feedback, Mentor, FeedbackMode } from '../types';
import { 
  ClipboardCopy, 
  MessageSquare, 
  Lightbulb, 
  Eye,
  BarChart3,
  CheckCircle,
  Sparkles,
  Coins,
  ArrowDown
} from 'lucide-react';
import ChunkedFeedbackView from './ChunkedFeedbackView';
import { backendApiService } from '../services/backendApiService';

interface FeedbackViewProps {
  feedback: Feedback;
  mentor: Mentor;
  feedbackMode?: FeedbackMode;
  onModeChange?: (mode: FeedbackMode) => void;
  onApplyFeedback?: () => void;
  onShowWriterSuggestions?: () => void;
  selectedChunkId?: string | null; // NEW: Add for consistency
}

const FeedbackView: React.FC<FeedbackViewProps> = ({ 
  feedback, 
  mentor, 
  feedbackMode = 'structured',
  onModeChange,
  onApplyFeedback,
  onShowWriterSuggestions
}) => {
  const [viewMode, setViewMode] = useState<'overview' | 'structured' | 'scratchpad'>('overview');
  const [copiedText, setCopiedText] = useState('');
  const [overviewContent, setOverviewContent] = useState<string>('');
  const [isGeneratingOverview, setIsGeneratingOverview] = useState(false);

  useEffect(() => {
    // Map feedbackMode to viewMode
    if (feedbackMode === 'structured') {
      setViewMode('structured');
    } else if (feedbackMode === 'scratchpad') {
      setViewMode('scratchpad');
    } else {
      setViewMode('overview');
    }
  }, [feedback.id, feedbackMode]);

  useEffect(() => {
    // Generate overview when feedback changes or when switching to overview mode
    if (viewMode === 'overview' && !overviewContent) {
      generateOverview();
    }
  }, [feedback.id, viewMode]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const handleModeChange = (mode: 'overview' | 'structured' | 'scratchpad') => {
    setViewMode(mode);
    
    // Convert to FeedbackMode and notify parent if needed
    if (mode !== 'overview' && onModeChange) {
      onModeChange(mode as FeedbackMode);
    }
  };

  // Generate AI overview based on feedback content
  const generateOverview = async () => {
    try {
      setIsGeneratingOverview(true);
      
      // Get content from both structured and scratchpad
      const structuredContent = feedback.structuredContent || '';
      const scratchpadContent = feedback.scratchpadContent || '';
      
      if (!structuredContent && !scratchpadContent) {
        setOverviewContent('No feedback content available to generate an overview.');
        return;
      }
      
      // Create prompt for AI to generate overview
      const prompt = `
You are ${mentor.name}, a screenplay mentor with the following style:
"${mentor.tone}"

You've provided feedback on a screenplay scene. Based on your feedback, create a concise overview summary.

The feedback you provided includes:

STRUCTURED FEEDBACK:
${structuredContent.substring(0, 1500)}

SCRATCHPAD NOTES:
${scratchpadContent.substring(0, 1500)}

Write a 3-paragraph overview (2-3 sentences each) that summarizes your key insights about this screenplay.
- Use your unique voice and perspective as ${mentor.name}
- Focus on the most important points from both structured feedback and scratchpad notes
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
          setOverviewContent(generateFallbackOverview(feedback, mentor));
        }
      } catch (error) {
        console.error('Failed to generate AI overview:', error);
        setOverviewContent(generateFallbackOverview(feedback, mentor));
      }
    } finally {
      setIsGeneratingOverview(false);
    }
  };

  // Generate a fallback overview if AI generation fails
  const generateFallbackOverview = (feedback: Feedback, mentor: Mentor): string => {
    const isBlended = mentor.id === 'blended';
    
    // Extract key points from feedback
    const structuredContent = feedback.structuredContent || '';
    const scratchpadContent = feedback.scratchpadContent || '';
    
    // Get first few sentences from each section
    const getFirstSentences = (text: string, count: number = 3): string => {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).slice(0, count);
      return sentences.join('. ') + '.';
    };
    
    const structuredSummary = getFirstSentences(structuredContent);
    const scratchpadSummary = getFirstSentences(scratchpadContent);
    
    // Create paragraphs based on mentor style
    let overview = '';
    
    if (isBlended) {
      overview = `This script presents a blend of strengths and challenges when viewed through multiple mentoring perspectives. The structure shows potential but requires refinement to fully realize its dramatic potential. The character work contains promising elements that could be enhanced through more specific choices and clearer objectives.\n\n`;
      
      overview += `From a dialogue perspective, there are moments of authenticity mixed with areas that need more subtext and purpose. The pacing varies throughout, with some sections moving effectively while others could benefit from tightening or expansion to better serve the story's rhythm. These observations represent a consensus across different mentoring approaches.\n\n`;
      
      overview += `Overall, this script demonstrates promise that can be fully realized through targeted revisions. By addressing the structural and character issues identified across multiple perspectives, while preserving the existing strengths, the screenplay can achieve a more compelling and cohesive form. The most critical next step is to ensure every scene serves the central dramatic engine while maintaining authentic character psychology.`;
    } else {
      switch (mentor.id) {
        case 'tony-gilroy':
          overview = `This script needs a clearer engine driving the narrative forward. The structure has potential but lacks the surgical precision needed to maintain momentum and purpose. Every scene must earn its place by advancing plot or revealing character in ways that feel inevitable yet surprising.\n\n`;
          
          overview += `The dialogue occasionally works but often falls into exposition or fails to reveal character through conflict. Look for opportunities to cut unnecessary exchanges and ensure every line serves multiple purposes - advancing story while revealing character simultaneously. The real drama often lies beneath the surface of what's being said.\n\n`;
          
          overview += `Overall, this screenplay requires a ruthless examination of what's essential versus what's merely interesting. Cut anything that doesn't directly serve your story engine, clarify character objectives in every scene, and ensure each moment creates inevitable momentum toward your conclusion. Remember: if nothing breaks when you remove a scene, it doesn't belong in your script.`;
          break;
          
        case 'sofia-coppola':
          overview = `This screenplay has moments of emotional authenticity that deserve to be amplified. The atmosphere and mood show potential, but could be more consistently developed to reflect the internal landscapes of your characters. There's room to trust silence and visual storytelling more deeply.\n\n`;
          
          overview += `Your character work contains promising elements, though the emotional truth sometimes gets buried under exposition. Look for opportunities to reveal feelings through behavior rather than dialogue, and trust that small, specific details often carry more emotional weight than explanations. The most powerful moments are often found in what remains unsaid.\n\n`;
          
          overview += `Overall, this script would benefit from a greater confidence in subtext and atmospheric detail. Focus on creating moments where environment and character psychology merge, where gestures reveal more than words, and where the audience is trusted to feel rather than be told. Remember that the truth lives in what isn't said - in the spaces between words.`;
          break;
          
        case 'vince-gilligan':
          overview = `This screenplay shows potential in its character foundations, though the psychological depth could be more consistently developed. The choices characters make sometimes feel driven by plot necessity rather than emerging organically from established traits and flaws. Every decision should feel both surprising and inevitable.\n\n`;
          
          overview += `The moral complexity of your story has interesting dimensions that could be further explored. Look for opportunities to place characters in situations where there are no clear right answers, where their core values come into conflict with their immediate needs. These impossible choices reveal character truth in ways that simple obstacles cannot.\n\n`;
          
          overview += `Overall, this script would benefit from a deeper exploration of how character psychology drives plot, rather than the reverse. Ensure that each character's actions emerge from their specific flaws and desires, creating consequences that feel both unexpected and unavoidable. Remember that character is plot - what would this specific person actually do in this impossible situation?`;
          break;
          
        case 'amy-pascal':
          overview = `This screenplay has elements that audiences could connect with, though the emotional stakes need to be more consistently clear and relatable. The characters show potential, but their journeys would resonate more deeply if grounded in universal human experiences that viewers can immediately recognize and feel.\n\n`;
          
          overview += `The script balances artistic elements with commercial appeal, though this balance could be more consistent throughout. Look for opportunities to maintain your unique voice while ensuring the audience always understands what's at stake emotionally for your characters. The most successful stories combine artistic integrity with broad human connection.\n\n`;
          
          overview += `Overall, this screenplay would benefit from a sharper focus on making us care about these specific characters and their journey. Ensure that beneath the plot mechanics lies a recognizable emotional truth that resonates across different audiences. Remember that great scripts make you forget you're reading - they make you care.`;
          break;
          
        default:
          overview = `This screenplay shows both strengths and areas for development. The structure has promising elements but could be more consistently focused on driving the central narrative forward. Character motivations are sometimes clear but would benefit from more specific objectives and obstacles throughout.\n\n`;
          
          overview += `The dialogue contains effective moments mixed with areas that could be more efficient and purposeful. Look for opportunities to reveal character through subtext rather than exposition, and ensure each exchange serves multiple dramatic functions. The pacing varies throughout, with some sections moving effectively while others could be tightened.\n\n`;
          
          overview += `Overall, this script demonstrates potential that can be realized through targeted revisions. Focus on clarifying the central dramatic question, ensuring character choices emerge from established traits, and maintaining consistent momentum throughout. With these adjustments, the screenplay will achieve a more compelling and cohesive form.`;
      }
    }
    
    return overview;
  };

  // Check if this is chunked feedback
  if (feedback.isChunked && feedback.chunkedFeedback) {
    return (
      <ChunkedFeedbackView
        chunkedFeedback={feedback.chunkedFeedback}
        mentor={mentor}
        feedbackMode={feedbackMode}
        onModeChange={onModeChange}
      />
    );
  }

  const getCurrentContent = (): string => {
    // Handle blended feedback specifically
    if (mentor.id === 'blended') {
      if (viewMode === 'scratchpad') {
        return feedback.scratchpadContent || feedback.content || 'No scratchpad content available for blended feedback.';
      } else if (viewMode === 'structured') {
        return feedback.structuredContent || feedback.content || 'No structured content available for blended feedback.';
      } else {
        // Overview mode - show AI-generated overview or summary
        return overviewContent || 'Generating overview...';
      }
    }
    
    // Handle regular mentor feedback
    if (viewMode === 'scratchpad') {
      return feedback.scratchpadContent || feedback.content || '';
    } else if (viewMode === 'structured') {
      return feedback.structuredContent || feedback.content || '';
    } else {
      // Overview mode - show AI-generated overview or summary
      return overviewContent || 'Generating overview...';
    }
  };

  const hasDualContent = Boolean(feedback.structuredContent && feedback.scratchpadContent);
  const isBlended = mentor.id === 'blended';

  return (
    <div 
      className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 h-[calc(100vh-16rem)] flex flex-col"
      style={{ boxShadow: `0 4px 12px ${mentor.accent}20` }}
    >
      {/* EXACT MATCH: Header identical to ChunkedFeedbackView */}
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
              {isBlended && (
                <div className="flex items-center gap-1 bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded-full text-xs font-medium border border-purple-500/30 flex-shrink-0">
                  <Sparkles className="h-3 w-3" />
                  <span>Blended</span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 italic truncate">
              <span className="hidden lg:inline">{mentor.tone}</span>
              <span className="lg:hidden">
                {mentor.tone.length > 20 ? `${mentor.tone.substring(0, 20)}...` : mentor.tone}
              </span>
            </p>
          </div>
        </div>

        {/* Center Section - Toggle Buttons */}
        <div className="flex items-center justify-center flex-1 px-4">
          <div className="flex bg-slate-700/50 rounded-lg p-1">
            <button
              onClick={() => handleModeChange('overview')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'overview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              type="button"
            >
              <Eye className="h-3 w-3" />
              <span className="hidden sm:inline">Overview</span>
            </button>
            
            <button
              onClick={() => handleModeChange('structured')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'structured'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              type="button"
            >
              <BarChart3 className="h-3 w-3" />
              <span className="hidden sm:inline">Structured</span>
            </button>
            
            <button
              onClick={() => handleModeChange('scratchpad')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'scratchpad'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              type="button"
            >
              <Lightbulb className="h-3 w-3" />
              <span className="hidden sm:inline">Scratchpad</span>
            </button>
          </div>
        </div>

        {/* Right Section - Copy Button */}
        <div className="flex items-center justify-end flex-shrink-0">
          <button
            onClick={() => copyToClipboard(getCurrentContent(), 'feedback')}
            className="p-2 hover:bg-slate-700 rounded-md transition-colors group"
            title="Copy feedback"
            type="button"
          >
            <ClipboardCopy className="h-4 w-4 text-slate-400 group-hover:text-white" />
          </button>
        </div>
      </div>

      {/* Main content area - clean and consistent */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Overview Mode - Clean layout like chunked feedback */}
          {viewMode === 'overview' && (
            <div className="space-y-6">
              {/* Overview content without extra header */}
              <div className="bg-slate-700/20 rounded-lg p-4 border border-slate-600/30">
                <h4 className="text-sm font-semibold text-yellow-400 mb-3">
                  {isBlended ? 'Multi-Mentor Analysis Summary' : 'Scene Analysis Summary'}
                </h4>
                <div className="text-slate-300 text-sm leading-relaxed">
                  {isGeneratingOverview ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-yellow-400 mr-2"></div>
                      <span>Generating overview...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {overviewContent.split('\n\n').map((paragraph, index) => (
                        <p key={index} className="text-slate-300">{paragraph}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/20 rounded-lg p-3 border border-slate-600/30 text-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Analysis Status</p>
                  <p className="text-sm font-medium text-white">Complete</p>
                </div>
                <div className="bg-slate-700/20 rounded-lg p-3 border border-slate-600/30 text-center">
                  <BarChart3 className="h-5 w-5 text-blue-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Feedback Type</p>
                  <p className="text-sm font-medium text-white">
                    {isBlended ? 'Blended' : 'Single Mentor'}
                  </p>
                </div>
              </div>

              {/* Mentor Recommendations Section */}
              <div className="mt-6 pt-4 border-t border-slate-600/30">
                <div className="bg-slate-700/20 rounded-lg p-4 border border-slate-600/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-purple-400" />
                    <h4 className="font-medium text-white text-sm">
                      {isBlended ? 'Blended Mentoring Recommendations' : `${mentor.name}'s Key Recommendations`}
                    </h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0"></div>
                      <p className="text-slate-300 text-sm">Focus on strengthening character objectives and obstacles</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0"></div>
                      <p className="text-slate-300 text-sm">Enhance dialogue efficiency and subtext</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0"></div>
                      <p className="text-slate-300 text-sm">Tighten scene structure for maximum dramatic impact</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-600/30 text-center">
                    <p className="text-sm text-yellow-400 italic">
                      "{mentor.mantra || 'Every script has a story worth telling.'}"
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      — {isBlended ? 'Blended Mentoring Philosophy' : mentor.name}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Structured Mode - Clean layout like chunked feedback */}
          {viewMode === 'structured' && (
            <div className="space-y-4">
              <div className="text-slate-300 text-sm leading-relaxed">
                {formatFeedbackText(getCurrentContent())}
              </div>
            </div>
          )}

          {/* Scratchpad Mode - Clean layout like chunked feedback */}
          {viewMode === 'scratchpad' && (
            <div className="space-y-4">
              <div className="text-slate-300 text-sm leading-relaxed">
                {formatFeedbackText(getCurrentContent())}
              </div>
            </div>
          )}

          {/* Blended feedback indicator */}
          {isBlended && (
            <div className="mt-6 pt-4 border-t border-slate-600">
              <div className="flex items-center gap-2 text-xs text-purple-400">
                <Sparkles className="h-3 w-3" />
                <span>This analysis combines insights from multiple mentoring perspectives</span>
              </div>
            </div>
          )}

          {/* Enhanced Writer Suggestions Footer */}
          <div className="mt-6 pt-4 border-t border-slate-600">
            <div className="bg-slate-700/20 rounded-lg p-4 border border-slate-600/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-yellow-400" />
                  <div>
                    <h4 className="font-medium text-white">Enhanced Writer Suggestions</h4>
                    <p className="text-sm text-slate-400">
                      Concrete before/after examples with {isBlended ? 'blended mentor' : 'mentor'} guidance
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={onShowWriterSuggestions}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm font-medium transition-all"
                    type="button"
                  >
                    <Sparkles className="h-4 w-4" />
                    View Suggestions
                  </button>

                  <div className="flex items-center gap-1 text-xs text-slate-400 justify-end">
                    <Coins className="h-3 w-3" />
                    <span>8 tokens</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">30-45 seconds</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Same as chunked feedback */}
      <div className="p-3 bg-slate-900 border-t border-slate-700 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span>
            Single scene analysis • {isBlended ? 'Blended mentor approach' : `${mentor.name}'s perspective`}
          </span>
          <span>
            Generated: {new Date(feedback.timestamp).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

// Enhanced feedback text formatting (keeping existing function)
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
    
    // Section headers
    if (trimmedLine.match(/^#{2,4}\s/)) {
      flushSection();
      currentSection = trimmedLine.replace(/^#{2,4}\s/, '').replace(/:/g, '');
      continue;
    }
    
    // Numbered points
    const numberedMatch = trimmedLine.match(/^\d+\.\s*(.+)/);
    if (numberedMatch) {
      sectionPoints.push(numberedMatch[1]);
      continue;
    }
    
    // Bold points
    const starredMatch = trimmedLine.match(/^\*\*([^*]+)\*\*:\s*(.+)/);
    if (starredMatch) {
      sectionPoints.push(`**${starredMatch[1]}**: ${starredMatch[2]}`);
      continue;
    }
    
    // Regular content
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

export default FeedbackView;