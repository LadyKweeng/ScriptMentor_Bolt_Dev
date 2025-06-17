// src/components/Header.tsx
import React from 'react';
import { supabase } from '../utils/supabaseClient';
import { BookOpenCheck, BookOpen, LogOut } from 'lucide-react';

interface HeaderProps {
  showLibrary: boolean;
  onToggleLibrary: () => void;
}

const Header: React.FC<HeaderProps> = ({ showLibrary, onToggleLibrary }) => {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="bg-slate-900 border-b border-slate-700 px-4 py-3">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-6 w-6 text-yellow-400" />
          <h1 className="text-xl font-bold text-white">ScriptMentor AI</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleLibrary}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            {showLibrary ? 'Hide Library' : 'Script Library'}
          </button>
          
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;