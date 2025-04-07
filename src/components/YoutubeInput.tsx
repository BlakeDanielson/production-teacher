import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { extractYoutubeVideoId } from '@/lib/youtubeApi';

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
    <div className="w-full">
      {label && (
        <label htmlFor="youtube-url" className="block text-sm font-medium mb-2 text-gray-300">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          type="url"
          id="youtube-url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-2 pr-10 border ${
            isValidUrl ? 'border-green-600' : errorMessage ? 'border-red-600' : 'border-gray-600'
          } rounded-md bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 ${
            isValidUrl ? 'focus:ring-green-500' : 'focus:ring-purple-500'
          }`}
        />
        
        {/* Status icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {isLoadingInfo ? (
            <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
          ) : isValidUrl ? (
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : value ? (
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ) : null}
        </div>
      </div>
      
      {errorMessage && (
        <p className="mt-1 text-sm text-red-500">{errorMessage}</p>
      )}
      
      {/* Video preview */}
      {isValidUrl && videoInfo && videoInfo.thumbnailUrl && (
        <div className="mt-3 flex items-center p-2 bg-gray-800 rounded-md">
          <div className="relative w-20 h-12 overflow-hidden rounded">
            <img 
              src={videoInfo.thumbnailUrl}
              alt="Video thumbnail"
              className="object-cover w-full h-full"
            />
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-300 truncate">
              {videoInfo.title || 'YouTube Video'}
            </p>
            <p className="text-xs text-gray-500">
              ID: {videoId}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default YoutubeInput; 