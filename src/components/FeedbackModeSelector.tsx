// src/components/FeedbackModeSelector.tsx - Simple mode selector for feedback view
import React from 'react';
import { FeedbackMode } from '../types';
import { BarChart3, MessageSquare } from 'lucide-react';

interface FeedbackModeSelectorProps {
  currentMode: FeedbackMode;
  onModeChange: (mode: FeedbackMode) => void;
  hasDualContent: boolean;
  isCompact?: boolean;
}

const FeedbackModeSelector: React.FC<FeedbackModeSelectorProps> = ({
  currentMode,
  onModeChange,
  hasDualContent,
  isCompact = false
}) => {
  if (!hasDualContent) return null;

  return (
    <div className={`flex ${isCompact ? 'gap-1' : 'gap-2'}`}>
      <button
        onClick={() => onModeChange('structured')}
        className={`${isCompact ? 'p-1.5' : 'p-2'} rounded-md transition-colors flex items-center gap-1 ${
          currentMode === 'structured'
            ? 'bg-blue-600 text-white'
            : 'bg-slate-700 text-slate-400 hover:text-white'
        }`}
        type="button"
        title="Structured feedback"
      >
        <BarChart3 className={isCompact ? 'h-3 w-3' : 'h-4 w-4'} />
        {!isCompact && <span className="text-xs">Structured</span>}
      </button>
      
      <button
        onClick={() => onModeChange('scratchpad')}
        className={`${isCompact ? 'p-1.5' : 'p-2'} rounded-md transition-colors flex items-center gap-1 ${
          currentMode === 'scratchpad'
            ? 'bg-yellow-600 text-white'
            : 'bg-slate-700 text-slate-400 hover:text-white'
        }`}
        type="button"
        title="Scratchpad notes"
      >
        <MessageSquare className={isCompact ? 'h-3 w-3' : 'h-4 w-4'} />
        {!isCompact && <span className="text-xs">Notes</span>}
      </button>
    </div>
  );
};

export default FeedbackModeSelector;