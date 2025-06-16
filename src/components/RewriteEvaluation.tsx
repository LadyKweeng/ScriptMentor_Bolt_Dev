// src/components/RewriteEvaluation.tsx
import React, { useState, useEffect } from 'react';
import { ScriptScene, Feedback, ScriptRewrite } from '../types';
import { rewriteEvaluationService } from '../services/rewriteEvaluationService';
import { TrendingUp, TrendingDown, BarChart3, CheckCircle, AlertTriangle, Loader } from 'lucide-react';

interface RewriteEvaluationProps {
  originalScene: ScriptScene;
  rewrittenScene: ScriptRewrite;
  feedback: Feedback;
  onClose?: () => void;
}

interface EvaluationData {
  improvements: string[];
  regressions: string[];
  overallScore: number;
  summary: string;
}

const RewriteEvaluation: React.FC<RewriteEvaluationProps> = ({
  originalScene,
  rewrittenScene,
  feedback,
  onClose
}) => {
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quickEval, setQuickEval] = useState<{ improved: boolean; summary: string } | null>(null);

  useEffect(() => {
    evaluateRewrite();
  }, [originalScene.id, rewrittenScene.id, feedback.id]);

  const evaluateRewrite = async () => {
    setIsLoading(true);
    
    try {
      // Get quick evaluation first
      const quick = rewriteEvaluationService.quickEvaluate(originalScene, rewrittenScene, feedback);
      setQuickEval(quick);
      
      // Get full evaluation
      const fullEvaluation = await rewriteEvaluationService.evaluateRewrite(
        originalScene,
        rewrittenScene,
        feedback
      );
      
      setEvaluation(fullEvaluation);
    } catch (error) {
      console.error('Evaluation failed:', error);
      setEvaluation({
        improvements: ['Unable to analyze improvements'],
        regressions: ['Analysis unavailable'],
        overallScore: 50,
        summary: 'Evaluation service temporarily unavailable'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 border-green-500/30';
    if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/30';
    if (score >= 40) return 'bg-orange-500/20 border-orange-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-center py-8">
          <Loader className="h-6 w-6 animate-spin text-yellow-400 mr-3" />
          <span className="text-slate-300">Evaluating rewrite...</span>
        </div>
        {quickEval && (
          <div className="mt-4 p-3 bg-slate-700/50 rounded-md">
            <p className="text-sm text-slate-400">Quick Analysis: {quickEval.summary}</p>
          </div>
        )}
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="text-center py-4">
          <AlertTriangle className="h-8 w-8 text-orange-400 mx-auto mb-2" />
          <p className="text-slate-300">Unable to evaluate rewrite</p>
          <button 
            onClick={evaluateRewrite}
            className="mt-2 text-sm text-blue-400 hover:text-blue-300"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-yellow-400" />
          <h3 className="font-medium text-white">Rewrite Evaluation</h3>
        </div>
        
        {/* Overall Score */}
        <div className={`px-3 py-1 rounded-full border ${getScoreBackground(evaluation.overallScore)}`}>
          <span className={`font-medium ${getScoreColor(evaluation.overallScore)}`}>
            {evaluation.overallScore}/100
          </span>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 ml-2"
          >
            ×
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Summary */}
        <div className="bg-slate-700/50 rounded-md p-3">
          <p className="text-sm text-slate-300">{evaluation.summary}</p>
        </div>

        {/* Improvements */}
        {evaluation.improvements.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Improvements ({evaluation.improvements.length})
            </h4>
            <div className="space-y-2">
              {evaluation.improvements.map((improvement, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300">{improvement}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regressions */}
        {evaluation.regressions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Areas for Attention ({evaluation.regressions.length})
            </h4>
            <div className="space-y-2">
              {evaluation.regressions.map((regression, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300">{regression}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
          <div className="text-center">
            <div className="text-lg font-medium text-green-400">
              {evaluation.improvements.length}
            </div>
            <div className="text-xs text-slate-400">Improvements</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-medium text-red-400">
              {evaluation.regressions.length}
            </div>
            <div className="text-xs text-slate-400">Regressions</div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-700">
          <button
            onClick={evaluateRewrite}
            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-md transition-colors"
          >
            Re-evaluate
          </button>
        </div>
      </div>
    </div>
  );
};

export default RewriteEvaluation;