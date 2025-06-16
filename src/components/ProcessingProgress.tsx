// src/components/ProcessingProgress.tsx
import React from 'react';

interface ProcessingProgressProps {
  progress: number; // 0-100
  message: string;
}

const ProcessingProgress: React.FC<ProcessingProgressProps> = ({ progress, message }) => {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-6 rounded-lg w-80 max-w-full">
        <h3 className="text-lg font-medium mb-3 text-center text-white">Processing Script</h3>
        
        <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
          <div 
            className="bg-yellow-400 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <p className="text-center text-slate-300 text-sm">{message}</p>
        <p className="text-center text-slate-400 text-xs mt-2">
          Large scripts may take a moment to process
        </p>
      </div>
    </div>
  );
};

export default ProcessingProgress;