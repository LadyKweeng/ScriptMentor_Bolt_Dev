import React, { useState, useEffect } from 'react';
import { ScriptScene, Feedback } from '../types';
import { Save, RefreshCw } from 'lucide-react';

interface SceneEditorProps {
  scene: ScriptScene;
  feedback?: Feedback;
  onSave: (updatedScene: ScriptScene) => void;
  onGenerateRewrite: () => void;
}

const SceneEditor: React.FC<SceneEditorProps> = ({ 
  scene, 
  feedback,
  onSave,
  onGenerateRewrite
}) => {
  const [content, setContent] = useState(scene.content);
  const [isEditing, setIsEditing] = useState(false);
  
  useEffect(() => {
    setContent(scene.content);
  }, [scene]);

  const handleSave = () => {
    onSave({
      ...scene,
      content
    });
    setIsEditing(false);
  };

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden h-[calc(100vh-16rem)] flex flex-col">
      <div className="flex justify-between items-center p-4 bg-slate-900">
        <h3 className="font-medium text-white">{scene.title || 'Untitled Scene'}</h3>
        <div className="flex gap-2">
          {isEditing ? (
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-md"
            >
              <Save className="h-4 w-4" />
              <span>Save</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-md"
              >
                Edit
              </button>
              <button
                onClick={onGenerateRewrite}
                className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded-md"
                title="Generate rewrite based on feedback"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Rewrite</span>
              </button>
            </>
          )}
        </div>
      </div>
      
      {isEditing ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 w-full p-4 bg-slate-800 text-slate-300 font-mono text-sm border-0 focus:ring-0 focus:outline-none resize-none overflow-auto"
        />
      ) : (
        <div className="flex-1 p-4 overflow-auto bg-slate-800 text-slate-300 font-mono text-sm whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
};

export default SceneEditor;