import React, { useState, useRef, useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = 'audio/*,video/*',
  maxSizeMB = 25,
  label = 'Drag and drop a file here, or click to select',
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const validateFile = useCallback((file: File): boolean => {
    // Size validation
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      setError(`File size (${fileSizeMB.toFixed(1)}MB) exceeds the maximum limit of ${maxSizeMB}MB`);
      return false;
    }

    // Type validation if accept is specified
    if (accept && accept !== '*') {
      const acceptedTypes = accept.split(',');
      const fileType = file.type;
      
      // Check if the file type matches any of the accepted types
      // We need to handle wildcards like audio/* or video/*
      const isValidType = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          // Handle wildcards like audio/* or video/*
          const category = type.replace('/*', '');
          return fileType.startsWith(category);
        }
        return type === fileType;
      });
      
      if (!isValidType) {
        setError(`File type not accepted. Please upload ${accept}`);
        return false;
      }
    }

    setError(null);
    return true;
  }, [accept, maxSizeMB]);

  const processFile = useCallback((file: File) => {
    if (validateFile(file)) {
      setSelectedFileName(file.name);
      onFileSelect(file);
    }
  }, [onFileSelect, validateFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  }, [disabled, processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  }, [processFile]);

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={accept}
          className="hidden"
          disabled={disabled}
        />
        <div className="flex flex-col items-center justify-center">
          <svg className="w-8 h-8 mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          
          {selectedFileName ? (
            <div className="text-center">
              <p className="text-sm text-gray-400">Selected file:</p>
              <p className="text-sm font-medium text-gray-300">{selectedFileName}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">{label}</p>
          )}
          
          <p className="text-xs text-gray-500 mt-1">Maximum file size: {maxSizeMB}MB</p>
        </div>
      </div>
      
      {error && (
        <div className="mt-2 text-sm text-red-500">{error}</div>
      )}
    </div>
  );
};

export default FileUpload; 