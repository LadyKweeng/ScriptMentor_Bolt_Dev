// src/components/UsageInsights.tsx
import React from 'react';
import { 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  Award,
  Target,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle,
  ExternalLink,
  Zap
} from 'lucide-react';
import { UsageInsight, PredictionData, AnalyticsData } from '../services/analyticsService';

interface UsageInsightsProps {
  insights: UsageInsight[];
  predictions: PredictionData | null;
  efficiency: AnalyticsData['efficiency'] | null;
  onUpgradeClick?: () => void;
  className?: string;
}

export const UsageInsights: React.FC<UsageInsightsProps> = ({
  insights,
  predictions,
  efficiency,
  onUpgradeClick,
  className = ''
}) => {
  // Get icon for insight type
  const getInsightIcon = (type: UsageInsight['type']) => {
    switch (type) {
      case 'optimization':
        return <Zap className="h-5 w-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'recommendation':
        return <Lightbulb className="h-5 w-5 text-purple-500" />;
      case 'achievement':
        return <Award className="h-5 w-5 text-green-500" />;
      default:
        return <Target className="h-5 w-5 text-slate-500" />;
    }
  };

  // Get background color for insight type
  const getInsightBackground = (type: UsageInsight['type']) => {
    switch (type) {
      case 'optimization':
        return 'bg-blue-50 border-blue-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'recommendation':
        return 'bg-purple-50 border-purple-200';
      case 'achievement':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority: UsageInsight['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  // Get confidence indicator for predictions
  const getConfidenceIndicator = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high':
        return <div className="w-3 h-3 bg-green-500 rounded-full" title="High confidence" />;
      case 'medium':
        return <div className="w-3 h-3 bg-yellow-500 rounded-full" title="Medium confidence" />;
      case 'low':
        return <div className="w-3 h-3 bg-red-500 rounded-full" title="Low confidence" />;
    }
  };

  // Sort insights by priority
  const sortedInsights = [...insights].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Smart Predictions */}
      {predictions && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="h-6 w-6 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900">Usage Predictions</h3>
            {getConfidenceIndicator(predictions.confidenceLevel)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Month-end Projection */}
            <div className={`p-4 rounded-lg border ${
              predictions.willExceedAllowance 
                ? 'bg-red-50 border-red-200' 
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">Projected Month-end Usage</span>
                {predictions.willExceedAllowance ? (
                  <ArrowUpRight className="h-4 w-4 text-red-500" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
              <p className="text-2xl font-bold text-slate-900">{predictions.projectedMonthEnd}</p>
              <p className={`text-sm ${
                predictions.willExceedAllowance ? 'text-red-600' : 'text-green-600'
              }`}>
                {predictions.willExceedAllowance ? 'May exceed allowance' : 'Within allowance'}
              </p>
            </div>

            {/* Days to Depletion */}
            {predictions.daysToDepletion && (
              <div className="p-4 rounded-lg border bg-yellow-50 border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">Days Until Token Depletion</span>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{predictions.daysToDepletion}</p>
                <p className="text-sm text-yellow-600">At current usage rate</p>
              </div>
            )}

            {/* Tier Recommendation */}
            {predictions.recommendedTier && (
              <div className="p-4 rounded-lg border bg-purple-50 border-purple-200 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-600">Recommended Upgrade</span>
                    <p className="text-lg font-semibold text-slate-900 capitalize">
                      {predictions.recommendedTier} Tier
                    </p>
                    <p className="text-sm text-purple-600">
                      Upgrade to avoid running out of tokens this month
                    </p>
                  </div>
                  {onUpgradeClick && (
                    <button
                      onClick={onUpgradeClick}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                      Upgrade Now
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Efficiency Insights */}
      {efficiency && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="h-6 w-6 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900">Efficiency Analysis</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm text-slate-600 mb-1">Most Efficient</div>
              <div className="font-semibold text-slate-900 capitalize">{efficiency.mostEfficientAction}</div>
            </div>
            
            <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-sm text-slate-600 mb-1">Avg Cost/Use</div>
              <div className="font-semibold text-slate-900">{efficiency.averageCostPerUse} tokens</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-slate-600 mb-1">Least Efficient</div>
              <div className="font-semibold text-slate-900 capitalize">{efficiency.leastEfficientAction}</div>
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <h4 className="font-medium text-slate-900 mb-3">Optimization Recommendations</h4>
            <div className="space-y-2">
              {efficiency.recommendedActions.map((action, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actionable Insights */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lightbulb className="h-6 w-6 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">Smart Insights</h3>
        </div>

        {sortedInsights.length > 0 ? (
          <div className="space-y-4">
            {sortedInsights.map((insight, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getInsightBackground(insight.type)}`}
              >
                <div className="flex items-start gap-3">
                  {getInsightIcon(insight.type)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-slate-900">{insight.title}</h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(insight.priority)}`}>
                        {insight.priority}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{insight.message}</p>
                    
                    {insight.actionable && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <CheckCircle className="h-3 w-3" />
                        <span>Actionable insight</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Lightbulb className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-2">No insights available yet</p>
            <p className="text-sm text-slate-400">
              Use AI features more to generate personalized insights and recommendations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};