import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stripeService } from '../services/stripeService';
import { CheckCircle, ArrowRight, Loader } from 'lucide-react';

const SuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [planName, setPlanName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlanInfo = async () => {
      try {
        const plan = await stripeService.getSubscriptionPlanName();
        setPlanName(plan);
      } catch (error) {
        console.error('Failed to fetch plan info:', error);
        setPlanName('Your Plan');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlanInfo();
  }, []);

  const handleContinue = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800 rounded-2xl p-8 text-center border border-slate-700">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-2xl font-bold text-white mb-4">
            Payment Successful!
          </h1>
          
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 mb-6">
              <Loader className="h-4 w-4 animate-spin text-slate-400" />
              <p className="text-slate-400">Loading your plan details...</p>
            </div>
          ) : (
            <p className="text-slate-400 mb-6">
              Welcome to <span className="text-yellow-400 font-semibold">{planName}</span>! 
              Your subscription is now active and you can start getting AI-powered 
              feedback on your screenplays.
            </p>
          )}

          {/* Features Unlocked */}
          <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-white mb-2">
              What's Next?
            </h3>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Upload your first screenplay</li>
              <li>• Choose from our AI mentors</li>
              <li>• Get detailed feedback and suggestions</li>
              <li>• Improve your writing with AI insights</li>
            </ul>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-semibold py-3 px-6 rounded-lg transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
          >
            Start Writing Better Scripts
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Support Note */}
          <p className="text-xs text-slate-500 mt-4">
            Need help? Contact our support team anytime.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuccessPage;