// src/components/ChunkSelector.tsx
import React from 'react';
import { ScriptChunk } from '../types';
import { 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  MoreHorizontal,
  BookOpen,
  Film,
  Clock
} from 'lucide-react';

interface ChunkSelectorProps {
  chunks: ScriptChunk[];
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string) => void;
  compact?: boolean;
}

const ChunkSelector: React.FC<ChunkSelectorProps> = ({
  chunks,
  selectedChunkId,
  onSelectChunk,
  compact = false
}) => {
  const selectedIndex = chunks.findIndex(chunk => chunk.id === selectedChunkId);
  
  const navigateChunk = (direction: 'prev' | 'next') => {
    const currentIndex = selectedIndex;
    let newIndex: number;
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : chunks.length - 1;
    } else {
      newIndex = currentIndex < chunks.length - 1 ? currentIndex + 1 : 0;
    }
    
    onSelectChunk(chunks[newIndex].id);
  };

  const getChunkIcon = (chunkType: ScriptChunk['chunkType']) => {
    switch (chunkType) {
      case 'act':
        return <Film className="h-4 w-4" />;
      case 'sequence':
        return <Clock className="h-4 w-4" />;
      case 'pages':
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getChunkTypeLabel = (chunkType: ScriptChunk['chunkType']) => {
    switch (chunkType) {
      case 'act':
        return 'Act';
      case 'sequence':
        return 'Sequence';
      case 'pages':
      default:
        return 'Section';
    }
  };

  // Generate page-based title for chunks
  const getChunkTitle = (chunk: ScriptChunk, index: number) => {
    if (chunk.startPage && chunk.endPage) {
      return `Pages ${chunk.startPage}-${chunk.endPage}`;
    }
    // Fallback: estimate pages based on content length and position
    const avgPagesPerChunk = 15; // Assume average 15 pages per chunk
    const startPage = (index * avgPagesPerChunk) + 1;
    const endPage = startPage + avgPagesPerChunk - 1;
    return `Pages ${startPage}-${endPage}`;
  };

  if (compact) {
    const selectedChunk = chunks[selectedIndex];
    return (
      <div className="flex items-center gap-2 bg-slate-700/30 rounded-lg p-2">
        <button
          onClick={() => navigateChunk('prev')}
          disabled={chunks.length <= 1}
          className="p-1 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4 text-slate-400" />
        </button>
        
        <div className="flex items-center gap-2 min-w-0">
          {selectedChunkId && selectedChunk && (
            <>
              {getChunkIcon(selectedChunk.chunkType || 'pages')}
              <span className="text-sm font-medium text-white truncate">
                {getChunkTitle(selectedChunk, selectedIndex)}
              </span>
              <span className="text-xs text-slate-400 flex-shrink-0">
                {selectedIndex + 1}/{chunks.length}
              </span>
            </>
          )}
        </div>
        
        <button
          onClick={() => navigateChunk('next')}
          disabled={chunks.length <= 1}
          className="p-1 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-400" />
            <h3 className="font-medium text-white">Script Navigation</h3>
          </div>
          <div className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
            {chunks.length} {getChunkTypeLabel(chunks[0]?.chunkType || 'pages')}s
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="p-3 border-b border-slate-700/50 flex items-center justify-between bg-slate-700/20">
        <button
          onClick={() => navigateChunk('prev')}
          disabled={chunks.length <= 1}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        
        {selectedChunkId && (
          <div className="text-center">
            <div className="text-sm font-medium text-white">
              {getChunkTitle(chunks[selectedIndex], selectedIndex)}
            </div>
            <div className="text-xs text-slate-400">
              {selectedIndex + 1} of {chunks.length}
            </div>
          </div>
        )}
        
        <button
          onClick={() => navigateChunk('next')}
          disabled={chunks.length <= 1}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm text-white transition-colors"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Chunk List */}
      <div className="max-h-64 overflow-y-auto">
        {chunks.map((chunk, index) => {
          const isSelected = chunk.id === selectedChunkId;
          const chunkTitle = getChunkTitle(chunk, index);
          
          return (
            <button
              key={chunk.id}
              onClick={() => onSelectChunk(chunk.id)}
              className={`w-full p-3 flex items-center gap-3 hover:bg-slate-700/50 transition-colors border-l-2 ${
                isSelected 
                  ? 'bg-slate-700/30 border-blue-400 text-white' 
                  : 'border-transparent text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`p-1.5 rounded ${isSelected ? 'bg-blue-400/20' : 'bg-slate-600/30'}`}>
                  {getChunkIcon(chunk.chunkType)}
                </div>
                
                <div className="text-left min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {chunkTitle}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>{getChunkTypeLabel(chunk.chunkType)} {index + 1}</span>
                    {chunk.characters.length > 0 && (
                      <span>• {chunk.characters.length} characters</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                {isSelected && (
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-slate-700/50 bg-slate-700/10">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-slate-400">Total Sections</div>
            <div className="text-sm font-medium text-white">{chunks.length}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Strategy</div>
            <div className="text-sm font-medium text-white capitalize">
              {chunks[0]?.chunkType || 'Pages'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Characters</div>
            <div className="text-sm font-medium text-white">
              {[...new Set(chunks.flatMap(chunk => chunk.characters))].length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChunkSelector;