import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Shield } from 'lucide-react';
import { parseScreenplay } from '../utils/parseScreenplay';

interface ScriptUploaderProps {
  onScriptUploaded: (content: string, title: string, characters: Record<string, any>) => void;
}

const ScriptUploader: React.FC<ScriptUploaderProps> = ({ onScriptUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!file) return;
 
    setFile(file);
    setIsProcessing(true);
    setUploadError(null);
    
    try {
      // Parse the script using the screenplay parser
      const parsedScript = await parseScreenplay(file);
      
      if (!parsedScript) {
        throw new Error('Failed to parse the screenplay.');
      }
      
      // Extract the formatted content from parsed scenes
      let formattedContent = '';
      
      if (parsedScript.scenes && Array.isArray(parsedScript.scenes)) {
        // Combine all scenes into a single formatted script
        formattedContent = parsedScript.scenes
          .map(scene => {
            let sceneContent = '';
            
            // Add scene heading
            if (scene.heading) {
              sceneContent += scene.heading.toUpperCase() + '\n\n';
            }
            
            // Add scene content (this already includes properly formatted action and dialogue)
            if (scene.content) {
              sceneContent += scene.content;
            }
            
            return sceneContent.trim();
          })
          .join('\n\n\n'); // Separate scenes with extra spacing
      }
      
      if (!formattedContent) {
        throw new Error('No valid screenplay content found in the uploaded file.');
      }
      
      // Get title from metadata or filename
      const title = parsedScript.metadata?.title || file.name.replace(/\.[^/.]+$/, "");
      
      console.log('📄 Script processed successfully - content will be encrypted before saving');
      
      // Pass the script data to the parent component
      onScriptUploaded(
        formattedContent, 
        title, 
        parsedScript.characters || {}
      );
      
      setIsProcessing(false);
    } catch (error: any) {
      console.error('Error processing file:', error);
      setUploadError(error.message || 'Error processing script file');
      setFile(null);
      setIsProcessing(false);
    }
  };

  const handleOpenFileDialog = () => {
    fileInputRef.current?.click();
  };

  const clearFile = () => {
    setFile(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper function to truncate filename for display
  const truncateFilename = (filename: string, maxLength: number = 40) => {
    if (filename.length <= maxLength) return filename;
    
    const extension = filename.split('.').pop();
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - extension!.length - 4) + '...';
    
    return `${truncatedName}.${extension}`;
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".fdx,.fountain,.celtx,.txt"
        className="hidden"
      />
      
      {!file ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
            ? 'border-yellow-400 bg-yellow-400/5'
            : 'border-slate-600 hover:border-slate-500 bg-slate-800/40'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <h3 className="text-lg font-medium text-slate-200 mb-2">
            Upload Your Screenplay
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Drag and drop your script file, or click to browse
          </p>
          <button
            onClick={handleOpenFileDialog}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Select Script File
          </button>
          <p className="text-xs text-slate-500 mt-4">
            Supports Final Draft (FDX), Fountain, Celtx, and TXT formats
          </p>
          
          {/* Encryption Notice */}
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
            <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
              <Shield className="h-4 w-4" />
              <span>Your scripts are automatically encrypted before storage</span>
            </div>
            <p className="text-xs text-green-300 mt-1">
              Content is protected with client-side encryption - even database administrators cannot read your scripts
            </p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-6 bg-slate-800/40 border-slate-700">
          <div className="flex items-start justify-between mb-4 min-w-0">
            <div className="flex items-center min-w-0 flex-1 mr-3">
              <FileText className="h-8 w-8 text-yellow-400 mr-3 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 
                  className="text-lg font-medium text-slate-200 truncate"
                  title={file.name} // Show full filename on hover
                >
                  {truncateFilename(file.name)}
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                  {file.name.length > 40 && (
                    <span className="text-xs bg-slate-700 px-2 py-0.5 rounded">
                      Hover for full name
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="text-slate-400 hover:text-slate-300 p-1 flex-shrink-0"
              title="Remove file"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {isProcessing ? (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-yellow-400"></div>
              <span className="ml-2 text-sm text-slate-300">Processing and encrypting script...</span>
            </div>
          ) : uploadError ? (
            <div className="text-red-400 text-sm py-2 bg-red-400/10 border border-red-400/20 rounded-md px-3">
              <div className="font-medium mb-1">Upload Error</div>
              <div className="text-xs">{uploadError}</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3 text-sm text-green-300">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Script uploaded successfully!</span>
                </div>
                <div className="text-xs text-green-400">
                  Ready for analysis. Content will be encrypted before saving to database.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScriptUploader;