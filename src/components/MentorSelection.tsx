import React, { useState } from 'react';
import { Mentor, MentorWeights, FeedbackMode } from '../types';
import { Sliders, Users, Check, ChevronDown, BookText, User, X } from 'lucide-react';

interface MentorSelectionProps {
  mentors: Mentor[];
  onSelectMentor: (mentor: Mentor, mode: FeedbackMode) => void;
  onBlendMentors: (mentorWeights: MentorWeights) => void;
  selectedMentorId?: string;
  feedbackMode?: FeedbackMode;
  onFeedbackModeChange?: (mode: FeedbackMode) => void;
}

const MentorSelection: React.FC<MentorSelectionProps> = ({
  mentors,
  onSelectMentor,
  onBlendMentors,
  selectedMentorId,
  feedbackMode = 'structured',
  onFeedbackModeChange
}) => {
  const [isBlendMode, setIsBlendMode] = useState(false);
  const [selectedMentors, setSelectedMentors] = useState<string[]>([]);
  const [mentorWeights, setMentorWeights] = useState<MentorWeights>({});
  const [expandedMentorId, setExpandedMentorId] = useState<string | null>(null);
  const [singleModeSelectedId, setSingleModeSelectedId] = useState<string>(selectedMentorId || 'tony-gilroy');

  const handleModeToggle = (mode: 'single' | 'blended') => {
    const newBlendMode = mode === 'blended';
    setIsBlendMode(newBlendMode);
    
    if (!newBlendMode) {
      // Switching to single mode - clear blended selections
      setSelectedMentors([]);
      setMentorWeights({});
    }
  };

  const handleSelectMentor = (mentor: Mentor) => {
    if (isBlendMode) {
      // Blended mode - toggle mentor selection and manage weights
      setSelectedMentors(prev => {
        const isCurrentlySelected = prev.includes(mentor.id);
        let newSelected: string[];
        
        if (isCurrentlySelected) {
          // Remove mentor
          newSelected = prev.filter(id => id !== mentor.id);
          // Remove from weights
          setMentorWeights(weights => {
            const { [mentor.id]: removed, ...rest } = weights;
            return rest;
          });
        } else {
          // Add mentor
          newSelected = [...prev, mentor.id];
          // Add to weights with default value
          setMentorWeights(weights => ({
            ...weights,
            [mentor.id]: 5
          }));
        }
        
        return newSelected;
      });
    } else {
      // Single mode - update the selected mentor ID
      setSingleModeSelectedId(mentor.id);
    }
  };

  const handleWeightChange = (mentorId: string, weight: number) => {
    setMentorWeights(prev => ({
      ...prev,
      [mentorId]: weight
    }));
  };

  const handleApplyBlend = () => {
    if (selectedMentors.length < 2) return;
    
    const filteredWeights = Object.fromEntries(
      Object.entries(mentorWeights).filter(([id]) => selectedMentors.includes(id))
    );
    
    console.log('🎯 Applying mentor blend:', {
      selectedMentors,
      weights: filteredWeights,
      mentorCount: selectedMentors.length
    });
    
    // Trigger the blended feedback generation
    onBlendMentors(filteredWeights);
  };

  const handleSingleMentorFeedback = () => {
    const mentor = mentors.find(m => m.id === singleModeSelectedId);
    if (mentor) {
      onSelectMentor(mentor, feedbackMode);
    }
  };

  const toggleMentorDescription = (mentorId: string) => {
    setExpandedMentorId(expandedMentorId === mentorId ? null : mentorId);
  };

  const truncateDescription = (text: string, maxLength: number = 20) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getSelectedMentorNames = () => {
    return selectedMentors.map(id => mentors.find(m => m.id === id)?.name).filter(Boolean);
  };

  const getSelectedSingleMentor = () => {
    return mentors.find(m => m.id === singleModeSelectedId);
  };

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 relative">
      {/* Header with title and mode toggle */}
      <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        {/* Left Section - Title */}
        <div className="flex items-center min-w-0 flex-1">
          <BookText className="h-4 w-4 text-yellow-400 mr-2 flex-shrink-0" />
          <h3 className="font-medium text-white text-sm sm:text-base">Mentors</h3>
        </div>

        {/* Right Section - Mode Toggle */}
        <div className="flex bg-slate-700 rounded-lg p-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleModeToggle('single')}
            className={`flex items-center justify-center px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium transition-all min-w-0 ${
              !isBlendMode
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-600'
            }`}
            title="Single Mode"
          >
            <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline ml-1 whitespace-nowrap">Single</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeToggle('blended')}
            className={`flex items-center justify-center px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium transition-all min-w-0 ${
              isBlendMode
                ? 'bg-yellow-500 text-slate-900 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-600'
            }`}
            title="Blending Mode"
          >
            <Sliders className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline ml-1 whitespace-nowrap">Blending Mode</span>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="p-4">
        {/* Single Mode Selected Mentor Info */}
        {!isBlendMode && singleModeSelectedId && getSelectedSingleMentor() && (
          <div className="bg-slate-700/50 rounded-lg p-4 mb-4 border border-slate-600">
            <div className="flex items-center gap-3 mb-3">
              <img 
                src={getSelectedSingleMentor()!.avatar} 
                alt={getSelectedSingleMentor()!.name}
                className="w-10 h-10 rounded-full object-cover border-2"
                style={{ borderColor: getSelectedSingleMentor()!.accent }}
              />
              <div>
                <p className="text-sm text-slate-400 mb-1">Selected:</p>
                <h4 className="font-medium text-white">{getSelectedSingleMentor()!.name}</h4>
              </div>
            </div>
            
            <p className="text-sm text-slate-300 mb-4 italic">
              {getSelectedSingleMentor()!.tone}
            </p>
            
            <button
              onClick={handleSingleMentorFeedback}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
            >
              Get Feedback ({getSelectedSingleMentor()!.name})
            </button>
          </div>
        )}

        {/* Blended Mode Instructions */}
        {isBlendMode && (
          <div className="bg-slate-700/50 rounded-lg p-4 mb-4 border border-slate-600">
            <p className="text-slate-300 text-sm mb-2">
              Select multiple mentors and adjust their influence to create a custom blend of feedback styles.
            </p>
            {selectedMentors.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-slate-400">
                    Selected: {getSelectedMentorNames().join(', ')}
                  </span>
                </div>
                <button
                  onClick={handleApplyBlend}
                  disabled={selectedMentors.length < 2}
                  className={`bg-yellow-500 text-slate-900 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedMentors.length < 2 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-400'
                  }`}
                >
                  Get Blended Feedback ({selectedMentors.length} mentors)
                </button>
                {selectedMentors.length < 2 && (
                  <p className="text-xs text-yellow-400 mt-2">Select at least 2 mentors to blend</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mentor List */}
        <div className="space-y-3">
          {mentors.map(mentor => {
            const isSelected = isBlendMode 
              ? selectedMentors.includes(mentor.id)
              : mentor.id === singleModeSelectedId;
            
            // In blending mode, hide description when mentor is selected
            const showDescription = !isBlendMode || !isSelected;
            
            return (
              <div
                key={mentor.id}
                className={`group relative flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? isBlendMode 
                      ? 'bg-yellow-500/10 border-yellow-500/30 shadow-sm'
                      : 'bg-blue-500/10 border-blue-500/30 shadow-sm'
                    : 'bg-slate-700/30 border-slate-600 hover:bg-slate-700/50 hover:border-slate-500'
                }`}
              >
                <img 
                  src={mentor.avatar} 
                  alt={mentor.name}
                  className="w-10 h-10 rounded-full object-cover border-2"
                  style={{ borderColor: mentor.accent }}
                />
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium ${
                    isSelected 
                      ? isBlendMode ? 'text-yellow-300' : 'text-blue-300'
                      : 'text-white'
                  }`}>
                    {mentor.name}
                  </h3>
                  {showDescription && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-400 italic">
                        {truncateDescription(mentor.tone)}
                      </p>
                      {mentor.tone.length > 20 && (
                        <button
                          onClick={() => toggleMentorDescription(mentor.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 underline"
                        >
                          {expandedMentorId === mentor.id ? 'less' : 'more'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Weight Slider for Blended Mode */}
                {isBlendMode && isSelected && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Weight:</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={mentorWeights[mentor.id] || 5}
                      onChange={(e) => handleWeightChange(mentor.id, parseInt(e.target.value))}
                      className="w-16 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${mentor.accent} 0%, ${mentor.accent} ${((mentorWeights[mentor.id] || 5) - 1) * 11.11}%, #475569 ${((mentorWeights[mentor.id] || 5) - 1) * 11.11}%, #475569 100%)`
                      }}
                    />
                    <span className="text-xs font-mono text-yellow-400 w-6 text-center">
                      {mentorWeights[mentor.id] || 5}
                    </span>
                  </div>
                )}

                {/* Selection Button/Indicator */}
                <button
                  onClick={() => handleSelectMentor(mentor)}
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                    isSelected
                      ? isBlendMode
                        ? 'bg-yellow-500 text-slate-900'
                        : 'bg-blue-500 text-white'
                      : 'bg-slate-600 text-slate-300 group-hover:bg-slate-500'
                  }`}
                >
                  {isSelected && <Check className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Screen Side Window for Expanded Description */}
      {expandedMentorId && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-md flex flex-col">
          {/* Close button */}
          <div className="flex justify-end p-4">
            <button
              onClick={() => setExpandedMentorId(null)}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Mentor info - Centered and Full Width */}
          {(() => {
            const mentor = mentors.find(m => m.id === expandedMentorId);
            if (!mentor) return null;

            return (
              <div className="flex-1 px-6 pb-6 flex flex-col justify-center max-w-2xl mx-auto w-full">
                <div className="flex items-center gap-4 mb-6">
                  <img 
                    src={mentor.avatar} 
                    alt={mentor.name}
                    className="w-16 h-16 rounded-full object-cover border-3"
                    style={{ borderColor: mentor.accent }}
                  />
                  <div>
                    <h3 className="font-medium text-white text-2xl">{mentor.name}</h3>
                    <p className="text-sm text-white/60">Mentor Profile</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-medium text-white/80 mb-3">Mentoring Style</h4>
                    <p className="text-white text-sm leading-relaxed">
                      {mentor.tone}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-lg font-medium text-white/80 mb-3">Approach</h4>
                    <p className="text-white text-sm leading-relaxed">
                      {mentor.styleNotes}
                    </p>
                  </div>

                  {mentor.mantra && (
                    <div>
                      <h4 className="text-lg font-medium text-white/80 mb-3">Philosophy</h4>
                      <blockquote className="text-white text-sm italic leading-relaxed pl-4">
                        "{mentor.mantra}"
                      </blockquote>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default MentorSelection;