import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { extractYoutubeVideoId } from '@/lib/youtubeApi';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface YoutubeInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidated?: (isValid: boolean, videoInfo?: { id: string; title?: string; thumbnailUrl?: string }) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}

const YoutubeInput: React.FC<YoutubeInputProps> = ({
  value,
  onChange,
  onValidated,
  disabled = false,
  label = 'YouTube Video URL',
  placeholder = 'https://www.youtube.com/watch?v=...'
}) => {
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<{ 
    title?: string; 
    thumbnailUrl?: string;
  } | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState<boolean>(false);

  // Validate the URL and extract video ID when the value changes
  useEffect(() => {
    setErrorMessage(null);
    
    if (!value) {
      setIsValidUrl(false);
      setVideoId(null);
      setVideoInfo(null);
      if (onValidated) onValidated(false);
      return;
    }
    
    try {
      const extractedId = extractYoutubeVideoId(value);
      
      if (extractedId) {
        setIsValidUrl(true);
        setVideoId(extractedId);
        if (onValidated) onValidated(true, { id: extractedId, ...videoInfo });
      } else {
        setIsValidUrl(false);
        setVideoId(null);
        setErrorMessage('Invalid YouTube URL format');
        if (onValidated) onValidated(false);
      }
    } catch (error) {
      setIsValidUrl(false);
      setVideoId(null);
      setErrorMessage('Error processing URL');
      if (onValidated) onValidated(false);
    }
  }, [value, onValidated, videoInfo]);

  // Fetch video info when a valid video ID is found
  useEffect(() => {
    if (!videoId) {
      setVideoInfo(null);
      return;
    }
    
    // This is a simple mock implementation
    // In a real app, you'd connect to YouTube API or a backend endpoint
    // that fetches video metadata using the API
    const fetchVideoInfo = async () => {
      setIsLoadingInfo(true);
      
      try {
        // This is a placeholder - In a real app, you'd make an API call
        // For now, we'll just set some mock data based on the video ID
        
        // Simple mock data using the video ID for the thumbnail
        setTimeout(() => {
          setVideoInfo({
            title: `Video ${videoId}`, // In a real app, get the actual title
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
          });
          setIsLoadingInfo(false);
        }, 500); // Simulate network delay
        
      } catch (error) {
        console.error('Error fetching video info:', error);
        setVideoInfo(null);
        setIsLoadingInfo(false);
      }
    };
    
    fetchVideoInfo();
  }, [videoId]);

  return (
    <div className="w-full space-y-3">
      {label && (
        <label htmlFor="youtube-url" className="text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      
      <div className="relative">
        <Input
          id="youtube-url"
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full ${
            isValidUrl ? 'border-green-600 focus-visible:ring-green-600' : 
            errorMessage ? 'border-red-500 focus-visible:ring-red-500' : ''
          }`}
        />
        
        {/* Status icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {isLoadingInfo ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : isValidUrl ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : value ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : null}
        </div>
      </div>
      
      {errorMessage && (
        <p className="text-sm text-red-500">{errorMessage}</p>
      )}
      
      {/* Video preview */}
      {isValidUrl && videoInfo && videoInfo.thumbnailUrl && (
        <Card className="overflow-hidden bg-card/60 border-[hsl(var(--border))]/30 smooth-transition">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="relative w-24 h-14 overflow-hidden rounded">
              <img 
                src={videoInfo.thumbnailUrl}
                alt="Video thumbnail"
                className="object-cover w-full h-full"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground truncate">
                {videoInfo.title || 'YouTube Video'}
              </p>
              <div className="mt-1">
                <Badge variant="secondary" className="text-xs bg-secondary/40">
                  ID: {videoId?.substring(0, 6)}...
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default YoutubeInput; 