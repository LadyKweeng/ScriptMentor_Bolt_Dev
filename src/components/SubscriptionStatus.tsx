import React, { useEffect, useState } from 'react';
import { stripeService } from '../services/stripeService';
import { Crown, Loader } from 'lucide-react';

const SubscriptionStatus: React.FC = () => {
  const [planName, setPlanName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlanInfo = async () => {
      try {
        const plan = await stripeService.getSubscriptionPlanName();
        setPlanName(plan);
      } catch (error) {
        console.error('Failed to fetch plan info:', error);
        setPlanName('Free Tier');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlanInfo();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <Loader className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading plan...</span>
      </div>
    );
  }

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'Pro':
        return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      case 'Creator':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'Free Tier':
      default:
        return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${getPlanColor(planName)}`}>
      <Crown className="h-4 w-4" />
      <span>{planName}</span>
    </div>
  );
};

export default SubscriptionStatus;