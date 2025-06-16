// src/components/ChunkProcessingProgress.tsx
import React from 'react';
import { ChunkProcessingProgress as ProgressType } from '../services/feedbackChunkService';
import { 
  FileText, 
  Brain, 
  CheckCircle, 
  Clock,
  Layers,
  TrendingUp
} from 'lucide-react';

interface ChunkProcessingProgressProps {
  progress: ProgressType;
  mentor: {
    name: string;
    avatar: string;
    accent: string;
  };
  onCancel?: () => void;
}

const ChunkProcessingProgress: React.FC<ChunkProcessingProgressProps> = ({
  progress,
  mentor,
  onCancel
}) => {
  const isComplete = progress.progress >= 100;
  const progressPercentage = Math.min(progress.progress, 100);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full mx-4 border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <img 
            src={mentor.avatar} 
            alt={mentor.name} 
            className="w-12 h-12 rounded-full object-cover border-2"
            style={{ borderColor: mentor.accent }}
          />
          <div>
            <h3 className="text-lg font-semibold text-white">
              {mentor.name} Analysis
            </h3>
            <p className="text-sm text-slate-400">
              Deep script feedback in progress
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">
              Processing Script Sections
            </span>
            <span className="text-sm text-slate-400">
              {progress.currentChunk}/{progress.totalChunks}
            </span>
          </div>
          
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full transition-all duration-500 ease-out rounded-full"
              style={{ 
                width: `${progressPercentage}%`,
                backgroundColor: mentor.accent,
                boxShadow: `0 0 10px ${mentor.accent}40`
              }}
            />
          </div>
          
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-slate-500">{progressPercentage}% complete</span>
            <span className="text-slate-400">
              {isComplete ? 'Analysis complete!' : `${progress.totalChunks - progress.currentChunk} sections remaining`}
            </span>
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-slate-700/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            {isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <Brain className="h-5 w-5 text-blue-400 animate-pulse" />
            )}
            <span className="text-sm font-medium text-white">
              {isComplete ? 'Complete' : 'Currently Analyzing'}
            </span>
          </div>
          
          <div className="text-sm text-slate-300 mb-2">
            {progress.chunkTitle}
          </div>
          
          <div className="text-xs text-slate-400">
            {progress.message}
          </div>
        </div>

        {/* Processing Details */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Layers className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-sm font-medium text-white">
              {progress.totalChunks}
            </div>
            <div className="text-xs text-slate-400">
              Sections
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-sm font-medium text-white">
              {progress.currentChunk}
            </div>
            <div className="text-xs text-slate-400">
              Analyzed
            </div>
          </div>
        </div>

        {/* Processing Steps */}
        <div className="space-y-3 mb-6">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Analysis Pipeline
          </div>
          
          {[
            { step: 'Script Chunking', completed: true },
            { step: 'Character Analysis', completed: progress.currentChunk > 0 },
            { step: 'Section Feedback', completed: progress.currentChunk > 0 },
            { step: 'Overall Summary', completed: isComplete }
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${
                item.completed ? 'bg-green-400' : 'bg-slate-600'
              }`} />
              <span className={`text-sm ${
                item.completed ? 'text-slate-300' : 'text-slate-500'
              }`}>
                {item.step}
              </span>
              {item.completed && (
                <CheckCircle className="h-3 w-3 text-green-400 ml-auto" />
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isComplete && onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Cancel Analysis
            </button>
          )}
          
          {isComplete && (
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
              style={{ 
                backgroundColor: mentor.accent,
                ':hover': { opacity: 0.9 }
              }}
            >
              View Results
            </button>
          )}
        </div>

        {/* Mentor Quote */}
        <div className="mt-6 pt-4 border-t border-slate-700 text-center">
          <p className="text-sm text-yellow-400 italic">
            "Quality analysis takes time, but the insights are worth it."
          </p>
          <p className="text-xs text-slate-400 mt-1">
            — {mentor.name}
          </p>
        </div>

        {/* Estimated Time */}
        {!isComplete && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Clock className="h-3 w-3" />
            <span>
              Estimated {Math.max(1, Math.ceil((progress.totalChunks - progress.currentChunk) * 0.5))} minutes remaining
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChunkProcessingProgress;