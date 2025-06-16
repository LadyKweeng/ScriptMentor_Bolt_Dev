import React from 'react';
import { Loader } from 'lucide-react';

interface LoadingOverlayProps {
  message: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-6 rounded-lg flex items-center gap-4">
        <Loader className="h-8 w-8 animate-spin text-yellow-400" />
        <p className="text-white">{message}</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;