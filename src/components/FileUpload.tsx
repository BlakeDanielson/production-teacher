import React, { useState, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { UploadCloud, Check, AlertCircle, FileIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

  const formatFileSize = (sizeBytes: number): string => {
    if (sizeBytes < 1024) {
      return `${sizeBytes} B`;
    } else if (sizeBytes < 1024 * 1024) {
      return `${(sizeBytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  return (
    <div className="w-full space-y-3">
      <Card
        className={`relative border-2 border-dashed rounded-lg p-6 cursor-pointer transition-all duration-300 group ${
          isDragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50 border-border'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm'}`}
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
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          {selectedFileName ? (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">File selected</p>
                <p className="text-xs text-muted-foreground mt-1 truncate max-w-[250px]">{selectedFileName}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{label}</p>
            </>
          )}
          
          <p className="text-xs text-muted-foreground mt-1">Maximum file size: {maxSizeMB}MB</p>
        </div>
      </Card>
      
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm ml-2">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default FileUpload; 