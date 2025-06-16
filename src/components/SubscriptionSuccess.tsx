// src/components/SubscriptionSuccess.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, ArrowLeft, Loader, Zap } from 'lucide-react';
import { StripeService } from '../services/stripeService';

const SubscriptionSuccess: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchSubscriptionDetails = async () => {
      try {
        // Get session ID from URL if available
        const params = new URLSearchParams(location.search);
        const sessionId = params.get('session_id');
        
        // Wait a moment to allow webhook processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Fetch subscription details
        const subscriptionData = await StripeService.getUserSubscription();
        setSubscription(subscriptionData);
        
        // If no subscription found, show error
        if (!subscriptionData && sessionId) {
          setError('Subscription processing. Please wait a moment and refresh.');
        }
      } catch (err) {
        console.error('Error fetching subscription details:', err);
        setError('Failed to load subscription details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptionDetails();
  }, [location.search]);

  const handleBackToApp = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full border border-slate-700 text-center">
          <Loader className="h-12 w-12 text-yellow-400 animate-spin mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-4">Processing Your Subscription</h1>
          <p className="text-slate-400 mb-6">
            Please wait while we confirm your subscription details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full border border-slate-700 text-center">
          <div className="bg-red-500/20 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
            <Zap className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Subscription Processing</h1>
          <p className="text-slate-400 mb-6">
            {error}
          </p>
          <button
            onClick={handleBackToApp}
            className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg mx-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full border border-slate-700">
        <div className="text-center">
          <div className="bg-green-500/20 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-4">Subscription Successful!</h1>
          
          <p className="text-slate-400 mb-6">
            Thank you for subscribing to ScriptMentor. Your account has been upgraded and you now have access to all premium features.
          </p>
          
          {subscription && (
            <div className="bg-slate-700/50 rounded-lg p-4 mb-6 text-left">
              <h2 className="text-lg font-medium text-white mb-3">Subscription Details</h2>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Plan:</span>
                  <span className="text-white font-medium">
                    {subscription.priceId === 'price_1RalzkEOpk1Bj1eeIqTOsYNq' ? 'Creator' : 
                     subscription.priceId === 'price_1Ram1AEOpk1Bj1ee2sRTCp8b' ? 'Pro' : 'Free'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-green-400">
                    {StripeService.formatSubscriptionStatus(subscription.status)}
                  </span>
                </div>
                
                {subscription.currentPeriodEnd && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Next Billing Date:</span>
                    <span className="text-white">
                      {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <button
            onClick={handleBackToApp}
            className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg mx-auto"
          >
            <Zap className="h-4 w-4" />
            Start Using Premium Features
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccess;