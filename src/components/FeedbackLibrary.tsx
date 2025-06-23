// src/components/FeedbackLibrary.tsx
import React, { useState, useEffect } from 'react';
import { feedbackLibraryService, FeedbackLibraryItem } from '../services/feedbackLibraryService';
import { BookOpen, Trash2, Clock, Shield, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';

interface FeedbackLibraryProps {
  onFeedbackSelected: (item: FeedbackLibraryItem) => void;
  onWriterSuggestionsSelected: (item: FeedbackLibraryItem) => void;
}

const FeedbackLibrary: React.FC<FeedbackLibraryProps> = ({ 
  onFeedbackSelected, 
  onWriterSuggestionsSelected 
}) => {
  const [items, setItems] = useState<FeedbackLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load items on component mount
  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const libraryItems = await feedbackLibraryService.getAllFeedbackLibraryItems();
      setItems(libraryItems);
    } catch (error: any) {
      console.error('Failed to load feedback library items:', error);
      setError(`Failed to load library: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }
    
    try {
      await feedbackLibraryService.deleteFeedbackLibraryItem(id);
      loadItems(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to delete item:', error);
      setError(`Failed to delete item: ${error.message || 'Unknown error'}`);
    }
  };

  const handleItemClick = (item: FeedbackLibraryItem) => {
    if (item.type === 'feedback') {
      onFeedbackSelected(item);
    } else if (item.type === 'writer_suggestions') {
      onWriterSuggestionsSelected(item);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeLabel = (type: string) => {
    return type === 'feedback' ? 'Feedback' : 'Writer Suggestions';
  };

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div>
            <h3 className="font-medium text-red-400">Error Loading Feedback Library</h3>
            <p className="text-sm text-slate-400 mt-1">{error}</p>
            <button 
              onClick={loadItems}
              className="mt-2 text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-yellow-400" />
          <h3 className="font-medium text-white">Feedback Library</h3>
          <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs border border-green-500/30">
            Connected
          </span>
        </div>
        <button
          onClick={loadItems}
          disabled={isLoading}
          className="p-1.5 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          title="Refresh library"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-auto max-h-96">
        {isLoading ? (
          <div className="p-6 text-center text-slate-400">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading feedback library...
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-slate-400">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No saved feedback yet</p>
            <p className="text-sm mt-1">
              Save feedback and writer suggestions to build your library
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Mentor
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Pages
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Security
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Date Created
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="hover:bg-slate-700/30 cursor-pointer transition-colors"
                  >
                    <td className="p-3">
                      <div className="font-medium text-white truncate max-w-xs">
                        {item.title}
                      </div>
                    </td>
                    <td className="p-3 text-slate-300 text-sm">
                      {item.mentor_names}
                    </td>
                    <td className="p-3 text-slate-300 text-sm">
                      {item.pages}
                    </td>
                    <td className="p-3">
                      <span 
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.type === 'feedback' 
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {getTypeLabel(item.type)}
                      </span>
                    </td>
                    <td className="p-3">
                      {item.is_encrypted ? (
                        <div className="flex items-center gap-1 text-green-400">
                          <ShieldCheck className="h-3 w-3" />
                          <span className="text-xs">Encrypted</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-yellow-400">
                          <Shield className="h-3 w-3" />
                          <span className="text-xs">Plain</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-slate-400 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(item.created_at)}
                      </div>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackLibrary;