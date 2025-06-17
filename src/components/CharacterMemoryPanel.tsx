import React, { useState } from 'react';
import { Character } from '../types';
import { User, ChevronDown, ChevronUp, Plus, ChevronRight } from 'lucide-react';

interface CharacterMemoryPanelProps {
  characters: Record<string, Character>;
  onAddNote: (character: string, note: string) => void;
}

const CharacterMemoryPanel: React.FC<CharacterMemoryPanelProps> = ({ 
  characters,
  onAddNote
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [activeCharacter, setActiveCharacter] = useState<string | null>(null);

  const togglePanel = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      // Reset character expansion when opening panel
      setExpandedCharacter(null);
    }
  };

  const toggleCharacter = (name: string) => {
    setExpandedCharacter(prev => prev === name ? null : name);
  };

  const handleAddNote = () => {
    if (activeCharacter && newNote.trim()) {
      onAddNote(activeCharacter, newNote.trim());
      setNewNote('');
    }
  };

  const sortedCharacters = Object.values(characters).sort((a, b) => 
    (a.name ?? '').localeCompare(b.name ?? '')
  );

  const characterCount = sortedCharacters.length;

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
      {/* Dropdown Header */}
      <button
        onClick={togglePanel}
        className="w-full p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-yellow-400" />
          <h3 className="font-medium text-white">Character Memory</h3>
          {characterCount > 0 && (
            <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-xs font-medium border border-yellow-500/30">
              {characterCount}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isExpanded && characterCount > 0 && (
            <span className="text-xs text-slate-400">
              {characterCount} character{characterCount !== 1 ? 's' : ''}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>
      
      {/* Expandable Content */}
      {isExpanded && (
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
      )}
      
      {/* Add Note Modal */}
      {activeCharacter && (
        <div className="p-4 bg-slate-700 border-t border-slate-600">
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
};

export default CharacterMemoryPanel;