import { useState, useEffect } from 'react';
import { TextInput, Text, Group, Badge, Image, Paper } from '@mantine/core';
import { extractYoutubeVideoId, getThumbnailUrl } from '@/lib/youtubeApi';

interface YouTubeInfo {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  duration?: number; // Duration in minutes
}

interface YouTubeInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidation: (isValid: boolean, info?: YouTubeInfo) => void;
  isDisabled?: boolean;
  error?: string;
}

export function YoutubeInput({
  value,
  onChange,
  onValidation,
  isDisabled = false,
  error
}: YouTubeInputProps) {
  const [isValidating, setIsValidating] = useState(false);
  
  // Function to validate and fetch video info
  const validateYoutubeUrl = async (url: string) => {
    if (!url) {
      onValidation(false);
      return;
    }
    
    setIsValidating(true);
    
    try {
      // Extract video ID
      const videoId = extractYoutubeVideoId(url);
      
      if (!videoId) {
        onValidation(false);
        setIsValidating(false);
        return;
      }
      
      // Get thumbnail URL
      const thumbnailUrl = getThumbnailUrl(videoId);
      
      // In a real implementation, we would fetch video details from YouTube API
      // For now, let's use a basic fetch to get some info from oEmbed
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      
      try {
        const response = await fetch(oembedUrl);
        const data = await response.json();
        
        // Create info object with actual data
        const info: YouTubeInfo = {
          id: videoId,
          title: data.title,
          thumbnailUrl: thumbnailUrl,
          // Note: oembed doesn't provide duration, for real implementation use YouTube API
          // or parse from the page. For now, estimate from title length (just for demo)
          duration: estimateDurationFromUrl(url)
        };
        
        onValidation(true, info);
      } catch (error) {
        // If oembed fails, still return basic info
        const info: YouTubeInfo = {
          id: videoId,
          thumbnailUrl: thumbnailUrl,
          duration: estimateDurationFromUrl(url)
        };
        
        onValidation(true, info);
      }
    } catch (error) {
      onValidation(false);
    } finally {
      setIsValidating(false);
    }
  };
  
  // Try to extract duration from URL "t" parameter - just a fallback approach
  // In real implementation, use the YouTube API
  function estimateDurationFromUrl(url: string): number | undefined {
    try {
      // Check if URL has a timestamp parameter
      const urlObj = new URL(url);
      const tParam = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
      
      if (tParam) {
        // Convert t param to minutes - just assume it's seconds
        const seconds = parseInt(tParam, 10);
        if (!isNaN(seconds)) {
          return Math.max(1, Math.ceil(seconds / 60)); // At least 1 minute
        }
      }
      
      // Parse from URL fragment like "#t=1h30m" or "#t=90m"
      const hash = urlObj.hash;
      if (hash && hash.includes('=')) {
        const timeStr = hash.split('=')[1];
        let totalMinutes = 0;
        
        // Hours
        const hours = timeStr.match(/(\d+)h/);
        if (hours) totalMinutes += parseInt(hours[1], 10) * 60;
        
        // Minutes
        const minutes = timeStr.match(/(\d+)m/);
        if (minutes) totalMinutes += parseInt(minutes[1], 10);
        
        // Seconds (convert to minutes)
        const seconds = timeStr.match(/(\d+)s/);
        if (seconds) totalMinutes += Math.ceil(parseInt(seconds[1], 10) / 60);
        
        if (totalMinutes > 0) return totalMinutes;
      }
      
      // Default for most YouTube videos - educated guess
      return 4;
    } catch {
      return 4; // Default 4 minutes if parsing fails
    }
  }
  
  // Validate URL on change (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value) {
        validateYoutubeUrl(value);
      } else {
        onValidation(false);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [value]);
  
  return (
    <TextInput
      label="YouTube Video URL"
      placeholder="https://www.youtube.com/watch?v=..."
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      error={error}
      disabled={isDisabled}
      size="sm"
      data-autofocus
    />
  );
} 