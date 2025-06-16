// src/components/ProgressiveProcessingProgress.tsx
import React from 'react';
import { ProcessingProgress } from '../services/progressiveFeedbackService';
import { 
  FileText, 
  Brain, 
  CheckCircle, 
  Clock,
  Layers,
  AlertTriangle,
  RefreshCw,
  Zap,
  TrendingUp,
  Shield,
  Users,
  User,
  Blend,
  Sparkles
} from 'lucide-react';

interface ProgressiveProcessingProgressProps {
  progress: ProcessingProgress;
  mentor: {
    name: string;
    avatar: string;
    accent: string;
  };
  onCancel?: () => void;
}

const ProgressiveProcessingProgress: React.FC<ProgressiveProcessingProgressProps> = ({
  progress,
  mentor,
  onCancel
}) => {
  const isComplete = progress.progress >= 100;
  const progressPercentage = Math.min(progress.progress, 100);
  const rateLimitedChunks = progress.completedChunks.filter(chunk => (chunk as any).processingError === 'rate limit').length;
  const otherFailedChunks = progress.completedChunks.filter(chunk => (chunk as any).processingError && (chunk as any).processingError !== 'rate limit').length;
  const hasFailures = rateLimitedChunks > 0 || otherFailedChunks > 0;
  const hasPartialResults = progress.completedChunks.length > 0;

  // Processing type specific configurations
  const getProcessingTypeConfig = () => {
    switch (progress.processingType) {
      case 'single':
        return {
          icon: User,
          title: 'Single Scene Analysis',
          description: 'Focused analysis of individual scene',
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/20',
          borderColor: 'border-blue-500/30'
        };
      case 'blended':
        return {
          icon: Blend,
          title: 'Blended Mentor Analysis',
          description: `Combining insights from ${progress.mentorCount || 'multiple'} mentors`,
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/20',
          borderColor: 'border-purple-500/30'
        };
      case 'chunked':
      default:
        return {
          icon: Layers,
          title: 'Chunked Script Analysis',
          description: 'Sequential processing of script sections',
          color: 'text-green-400',
          bgColor: 'bg-green-500/20',
          borderColor: 'border-green-500/30'
        };
    }
  };

  const typeConfig = getProcessingTypeConfig();

  // Enhanced title for different processing types
  const getEnhancedTitle = () => {
    if (progress.processingType === 'blended') {
      return `${mentor.name} (${progress.mentorCount} Mentors)`;
    }
    return `${mentor.name} Progressive Analysis`;
  };

  // Enhanced subtitle for different processing types
  const getEnhancedSubtitle = () => {
    if (progress.isRetrying) {
      return 'Handling rate limits intelligently';
    }
    
    switch (progress.processingType) {
      case 'single':
        return 'Deep analysis of scene content';
      case 'blended':
        return `Blending ${progress.blendingMentors?.join(', ') || 'multiple mentors'}`;
      case 'chunked':
      default:
        return 'Processing script sections sequentially';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-8 max-w-lg w-full mx-4 border border-slate-700 shadow-2xl">
        {/* Enhanced Header with Processing Type */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <img 
              src={mentor.avatar} 
              alt={mentor.name} 
              className="w-12 h-12 rounded-full object-cover border-2"
              style={{ borderColor: mentor.accent }}
            />
            {/* Processing type indicator */}
            <div 
              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${typeConfig.bgColor} ${typeConfig.borderColor} border flex items-center justify-center`}
            >
              <typeConfig.icon className={`h-3 w-3 ${typeConfig.color}`} />
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              {getEnhancedTitle()}
            </h3>
            <p className="text-sm text-slate-400">
              {getEnhancedSubtitle()}
            </p>
            
            {/* Processing type badge */}
            <div className={`inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-full text-xs font-medium ${typeConfig.bgColor} ${typeConfig.color} ${typeConfig.borderColor} border`}>
              <typeConfig.icon className="h-3 w-3" />
              <span>{typeConfig.title}</span>
            </div>
          </div>
        </div>

        {/* Enhanced Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">
              {progress.processingType === 'single' ? 'Scene Progress' : 'Section Progress'}
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
                backgroundColor: progress.isRetrying ? '#f59e0b' : mentor.accent,
                boxShadow: `0 0 10px ${progress.isRetrying ? '#f59e0b' : mentor.accent}40`
              }}
            />
          </div>
          
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-slate-500">{progressPercentage}% complete</span>
            <span className="text-slate-400">
              {isComplete ? 'Analysis complete!' : 
               progress.isRetrying ? `Retry ${progress.retryCount! + 1}` :
               `${progress.totalChunks - progress.currentChunk} ${progress.processingType === 'single' ? 'steps' : 'sections'} remaining`}
            </span>
          </div>
        </div>

        {/* Enhanced Current Status */}
        <div className="bg-slate-700/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            {isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : progress.isRetrying ? (
              <RefreshCw className="h-5 w-5 text-yellow-400 animate-spin" />
            ) : (
              <Brain className="h-5 w-5 text-blue-400 animate-pulse" />
            )}
            <span className="text-sm font-medium text-white">
              {isComplete ? 'Complete' : 
               progress.isRetrying ? 'Handling Rate Limit' :
               progress.processingType === 'single' ? 'Analyzing Scene' :
               progress.processingType === 'blended' ? 'Blending Perspectives' :
               'Currently Analyzing'}
            </span>
          </div>
          
          <div className="text-sm text-slate-300 mb-2">
            {progress.chunkTitle}
          </div>
          
          <div className="text-xs text-slate-400">
            {progress.message}
          </div>

          {/* Blended mentors display */}
          {progress.processingType === 'blended' && progress.blendingMentors && (
            <div className="mt-3 flex flex-wrap gap-1">
              {progress.blendingMentors.map((mentorName, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs border border-purple-500/30"
                >
                  <Sparkles className="h-3 w-3" />
                  {mentorName}
                </span>
              ))}
            </div>
          )}

          {progress.nextRetryIn && (
            <div className="mt-3 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
              <div className="flex items-center gap-2 text-yellow-400 text-xs">
                <Clock className="h-3 w-3" />
                <span>Next retry in {Math.round(progress.nextRetryIn / 1000)}s</span>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Processing Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-sm font-medium text-white">
              {progress.completedChunks.filter(chunk => !(chunk as any).processingError).length}
            </div>
            <div className="text-xs text-slate-400">
              {progress.processingType === 'blended' ? 'Blended' : 'AI Analyzed'}
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <RefreshCw className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-sm font-medium text-white">
              {rateLimitedChunks}
            </div>
            <div className="text-xs text-slate-400">
              Rate Limited
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <typeConfig.icon className={`h-4 w-4 ${typeConfig.color}`} />
            </div>
            <div className="text-sm font-medium text-white">
              {progress.totalChunks}
            </div>
            <div className="text-xs text-slate-400">
              Total
            </div>
          </div>
        </div>

        {/* Adaptive Processing Features */}
        {!isComplete && (
          <div className="space-y-3 mb-6">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Intelligent Processing
            </div>
            
            {[
              { 
                feature: 'Rate Limit Detection', 
                active: progress.isRetrying, 
                icon: Shield,
                description: 'Automatically detecting and handling API limits'
              },
              { 
                feature: progress.processingType === 'single' ? 'Focused Analysis' : 'Sequential Processing', 
                active: true, 
                icon: TrendingUp,
                description: progress.processingType === 'single' 
                  ? 'Deep analysis of scene content and structure'
                  : 'Processing one section at a time for reliability'
              },
              { 
                feature: progress.processingType === 'blended' ? 'Multi-Mentor Blending' : 'Exponential Backoff', 
                active: progress.processingType === 'blended' ? true : progress.isRetrying, 
                icon: progress.processingType === 'blended' ? Users : Clock,
                description: progress.processingType === 'blended'
                  ? `Combining insights from ${progress.mentorCount || 'multiple'} mentors`
                  : 'Smart retry timing to respect API constraints'
              },
              { 
                feature: 'Partial Results', 
                active: hasPartialResults, 
                icon: Zap,
                description: progress.processingType === 'single'
                  ? 'Live updates as analysis progresses'
                  : 'Showing results as sections complete'
              }
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <item.icon className={`w-3 h-3 ${
                  item.active ? 'text-green-400' : 'text-slate-600'
                }`} />
                <div className="flex-1">
                  <span className={`text-sm ${
                    item.active ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {item.feature}
                  </span>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {item.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Enhanced Completion Status */}
        {isComplete && (
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              {hasFailures ? (
                <RefreshCw className="h-4 w-4 text-yellow-400" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-400" />
              )}
              <span className="text-sm font-medium text-white">
                {hasFailures ? 'Partial Success with Rate Limits' : 'Complete Success'}
              </span>
            </div>
            <p className="text-xs text-slate-400 text-center">
              {(() => {
                const aiAnalyzed = progress.completedChunks.filter(chunk => !(chunk as any).processingError).length;
                const rateLimited = progress.completedChunks.filter(chunk => (chunk as any).processingError === 'rate limit').length;
                const otherFailed = progress.completedChunks.filter(chunk => (chunk as any).processingError && (chunk as any).processingError !== 'rate limit').length;
                
                if (progress.processingType === 'single') {
                  return aiAnalyzed > 0 ? 'Scene analyzed with AI feedback' : 'Scene analysis completed';
                } else if (progress.processingType === 'blended') {
                  if (rateLimited > 0 && otherFailed > 0) {
                    return `${aiAnalyzed} sections blended, ${rateLimited} rate limited, ${otherFailed} other issues`;
                  } else if (rateLimited > 0) {
                    return `${aiAnalyzed} sections blended, ${rateLimited} hit rate limits`;
                  } else if (otherFailed > 0) {
                    return `${aiAnalyzed} sections blended, ${otherFailed} had processing issues`;
                  } else {
                    return `All ${progress.completedChunks.length} sections analyzed with blended mentor feedback`;
                  }
                } else {
                  if (rateLimited > 0 && otherFailed > 0) {
                    return `${aiAnalyzed} AI analyzed, ${rateLimited} rate limited, ${otherFailed} other issues`;
                  } else if (rateLimited > 0) {
                    return `${aiAnalyzed} AI analyzed, ${rateLimited} hit rate limits (can retry later)`;
                  } else if (otherFailed > 0) {
                    return `${aiAnalyzed} AI analyzed, ${otherFailed} had processing issues`;
                  } else {
                    return `All ${progress.completedChunks.length} sections analyzed with AI feedback`;
                  }
                }
              })()}
            </p>
          </div>
        )}

        {/* Enhanced Mentor Quote */}
        <div className="mt-6 pt-4 border-t border-slate-700 text-center">
          <p className="text-sm text-yellow-400 italic">
            {progress.processingType === 'single' 
              ? "Every scene tells a story within the story."
              : progress.processingType === 'blended'
              ? "Multiple perspectives reveal the full picture."
              : "Good analysis takes patience and persistence."
            }
          </p>
          <p className="text-xs text-slate-400 mt-1">
            — {progress.processingType === 'blended' ? 'Blended Mentors' : mentor.name}
          </p>
        </div>

        {/* Cancel Button */}
        {onCancel && !isComplete && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel Processing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressiveProcessingProgress;