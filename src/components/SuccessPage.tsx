// src/components/SuccessPage.tsx
import React, { useEffect } from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';

const SuccessPage: React.FC = () => {
  useEffect(() => {
    // Redirect to app after 5 seconds
    const timer = setTimeout(() => {
      window.location.href = '/';
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-6" />
        
        <h1 className="text-3xl font-bold mb-4">Payment Successful!</h1>
        
        <p className="text-slate-400 mb-8">
          Thank you for subscribing to ScriptMentor AI. Your account has been upgraded and you now have access to all premium features.
        </p>
        
        <div className="space-y-4">
          <button
            onClick={() => window.location.href = '/'}
            className="w-full flex items-center justify-center gap-2 bg-yellow-400 text-slate-900 py-3 px-6 rounded-lg font-medium hover:bg-yellow-300 transition-colors"
          >
            Start Using ScriptMentor AI
            <ArrowRight className="h-4 w-4" />
          </button>
          
          <p className="text-xs text-slate-500">
            Redirecting automatically in 5 seconds...
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuccessPage;