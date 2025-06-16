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
  Sparkles
} from 'lucide-react';
import ChunkedFeedbackView from './ChunkedFeedbackView';

interface FeedbackViewProps {
  feedback: Feedback;
  mentor: Mentor;
  feedbackMode?: FeedbackMode;
  onModeChange?: (mode: FeedbackMode) => void;
  onApplyFeedback?: () => void;
}

const FeedbackView: React.FC<FeedbackViewProps> = ({ 
  feedback, 
  mentor, 
  feedbackMode = 'structured',
  onModeChange,
  onApplyFeedback
}) => {
  const [viewMode, setViewMode] = useState<'overview' | 'structured' | 'scratchpad'>('overview');
  const [copiedText, setCopiedText] = useState('');

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
        // Overview mode - show summary or structured content
        return feedback.structuredContent || feedback.content || 'No content available for overview.';
      }
    }
    
    // Handle regular mentor feedback
    if (viewMode === 'scratchpad') {
      return feedback.scratchpadContent || feedback.content || '';
    } else if (viewMode === 'structured') {
      return feedback.structuredContent || feedback.content || '';
    } else {
      // Overview mode
      return feedback.structuredContent || feedback.content || '';
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
                  {formatFeedbackText(getCurrentContent()).slice(0, 3)} {/* Show first 3 sections */}
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

          {/* Mentor quote */}
          <div className="mt-6 pt-4 border-t border-slate-600 text-center">
            <p className="text-sm text-yellow-400 italic">
              "{mentor.mantra || 'Every script has a story worth telling.'}"
            </p>
            <p className="text-xs text-slate-400 mt-1">
              — {isBlended ? 'Blended Mentoring Philosophy' : mentor.name}
            </p>
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