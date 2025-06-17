import React from 'react';
import { supabase } from '../utils/supabaseClient';
import { LogOut, BookOpenCheck } from 'lucide-react';
import SubscriptionStatus from './SubscriptionStatus';

const Header: React.FC = () => {
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-8 w-8 text-yellow-400" />
            <h1 className="text-xl font-bold text-white">ScriptMentor AI</h1>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Subscription Status */}
            <SubscriptionStatus />
            
            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;