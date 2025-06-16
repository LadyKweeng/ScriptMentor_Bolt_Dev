// src/components/ScriptNavigationPanel.tsx
import React, { useState } from 'react';
import { Character, ScriptChunk } from '../types';
import { 
  User, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  ChevronRight,
  BookOpen,
  FileText,
  Film,
  Clock,
  ChevronLeft
} from 'lucide-react';

interface ScriptNavigationPanelProps {
  // Character Memory props
  characters: Record<string, Character>;
  onAddNote: (character: string, note: string) => void;
  
  // Script Navigation props
  chunks?: ScriptChunk[];
  selectedChunkId?: string | null;
  onSelectChunk?: (chunkId: string) => void;
  isChunkedScript?: boolean;
}

type TabType = 'navigation' | 'characters';

const ScriptNavigationPanel: React.FC<ScriptNavigationPanelProps> = ({ 
  characters,
  onAddNote,
  chunks = [],
  selectedChunkId,
  onSelectChunk,
  isChunkedScript = false
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('navigation');
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [activeCharacter, setActiveCharacter] = useState<string | null>(null);

  const sortedCharacters = Object.values(characters).sort((a, b) => 
    (a.name ?? '').localeCompare(b.name ?? '')
  );
  const characterCount = sortedCharacters.length;

  // Script Navigation helper functions
  const selectedIndex = chunks.findIndex(chunk => chunk.id === selectedChunkId);
  
  const navigateChunk = (direction: 'prev' | 'next') => {
    if (!onSelectChunk) return;
    
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

  const getChunkTitle = (chunk: ScriptChunk, index: number) => {
    if (chunk.startPage && chunk.endPage) {
      return `Pages ${chunk.startPage}-${chunk.endPage}`;
    }
    const avgPagesPerChunk = 15;
    const startPage = (index * avgPagesPerChunk) + 1;
    const endPage = startPage + avgPagesPerChunk - 1;
    return `Pages ${startPage}-${endPage}`;
  };

  // Character Memory helper functions
  const toggleCharacter = (name: string) => {
    setExpandedCharacter(prev => prev === name ? null : name);
  };

  const handleAddNote = () => {
    if (activeCharacter && newNote.trim()) {
      onAddNote(activeCharacter, newNote.trim());
      setNewNote('');
      setActiveCharacter(null);
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'navigation' && isChunkedScript && chunks.length > 0) {
      return (
        <div className="space-y-4">
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
                  onClick={() => onSelectChunk?.(chunk.id)}
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
    }

    if (activeTab === 'characters') {
      return (
        <div className="space-y-4">
          {/* Character List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-700">
            {sortedCharacters.length === 0 ? (
              <div className="p-4 text-sm text-slate-400 text-center">
                Characters will appear here as they are detected in scenes.
              </div>
            ) : (
              sortedCharacters.map(character => (
                <div key={character.name} className="text-sm">
                  <button 
                    onClick={() => toggleCharacter(character.name)}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-700/50 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{character.name}</span>
                      <span className="text-xs text-slate-400">
                        ({character.notes.length} note{character.notes.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    {expandedCharacter === character.name ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  
                  {expandedCharacter === character.name && (
                    <div className="px-3 pb-3">
                      <ul className="mb-3 pl-4 border-l border-slate-700">
                        {character.notes.map((note, index) => (
                          <li key={index} className="py-1.5 text-slate-300 relative">
                            <div className="absolute left-[-4px] top-3 w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                            {note}
                          </li>
                        ))}
                      </ul>
                      
                      <button
                        onClick={() => {
                          setActiveCharacter(character.name);
                          setNewNote('');
                        }}
                        className="text-xs flex items-center gap-1 text-yellow-400 hover:text-yellow-300"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add observation</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add Note Modal */}
          {activeCharacter && (
            <div className="p-4 bg-slate-700 border-t border-slate-600 rounded-b-lg">
              <h4 className="text-sm font-medium text-slate-200 mb-2">
                Add note for {activeCharacter}:
              </h4>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter character observation or trait..."
                className="w-full p-2 bg-slate-800 text-slate-300 text-sm border border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 mb-3"
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setActiveCharacter(null)}
                  className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className={`px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded-md ${
                    !newNote.trim() && 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  Add Note
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Default content when no script navigation is available
    if (activeTab === 'navigation') {
      return (
        <div className="p-4 text-sm text-slate-400 text-center">
          Script navigation will appear here when you upload a chunked script.
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
      {/* Header with yellow icon matching Mentors style */}
      <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-yellow-400" />
          <h3 className="font-medium text-white">Script Navigation & Characters</h3>
        </div>
      </div>

      {/* Tab Header */}
      <div className="bg-slate-900 border-b border-slate-700">
        <div className="flex">
          <button
            onClick={() => setActiveTab('navigation')}
            className={`flex-1 p-3 flex items-center justify-center gap-2 transition-colors text-sm ${
              activeTab === 'navigation'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span className="font-medium">Navigation</span>
            {isChunkedScript && chunks.length > 0 && (
              <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs border border-blue-500/30">
                {chunks.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('characters')}
            className={`flex-1 p-3 flex items-center justify-center gap-2 transition-colors text-sm ${
              activeTab === 'characters'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span className="font-medium">Characters</span>
            {characterCount > 0 && (
              <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-xs border border-yellow-500/30">
                {characterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ScriptNavigationPanel;