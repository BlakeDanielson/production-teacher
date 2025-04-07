import { AnalysisType } from '@/types';

// Base processing times in seconds for different operations
const BASE_TIMES = {
  downloading: {
    video: 5,   // Base time to download a video in seconds
    audio: 3    // Base time to download audio in seconds
  },
  processing: {
    video: 4,   // Base time to process video
    audio: 2    // Base time to process audio
  },
  analyzing: {
    video: 20,  // Base time for AI to analyze video
    audio: 15   // Base time for AI to analyze audio
  }
};

// Time multipliers based on video duration
const DURATION_MULTIPLIERS = {
  // Time multiplier per minute of content
  downloading: {
    video: 0.5,  // Each minute of video adds 0.5s to download
    audio: 0.2   // Each minute of audio adds 0.2s to download
  },
  processing: {
    video: 0.3,  // Each minute of video adds 0.3s to processing
    audio: 0.2   // Each minute of audio adds 0.2s to processing
  },
  analyzing: {
    video: 2,    // Each minute of video adds 2s to AI analysis
    audio: 1.5   // Each minute of audio adds 1.5s to AI analysis
  }
};

/**
 * Estimates total processing time in seconds for YouTube content analysis
 * 
 * @param durationMinutes Duration of the YouTube content in minutes
 * @param analysisType Whether we're analyzing 'video' or 'audio'
 * @returns Estimated total processing time in seconds
 */
export function estimateProcessingTime(durationMinutes: number, analysisType: AnalysisType): number {
  // Default to 5 minutes if we don't have duration info
  const contentLength = durationMinutes || 5;
  
  // Calculate time for each stage
  const downloadTime = BASE_TIMES.downloading[analysisType] + 
                      (contentLength * DURATION_MULTIPLIERS.downloading[analysisType]);
  
  const processingTime = BASE_TIMES.processing[analysisType] + 
                        (contentLength * DURATION_MULTIPLIERS.processing[analysisType]);
  
  const analysisTime = BASE_TIMES.analyzing[analysisType] + 
                      (contentLength * DURATION_MULTIPLIERS.analyzing[analysisType]);
  
  // Add a safety buffer (10%)
  const totalTime = (downloadTime + processingTime + analysisTime) * 1.1;
  
  return Math.round(totalTime);
}

/**
 * Estimates the time remaining based on current progress
 * Uses a hybrid approach of percentage-based and time-based estimation
 * 
 * @param progress Current progress percentage (0-100)
 * @param startTime When the operation started
 * @param durationMinutes Duration of the YouTube content in minutes
 * @param analysisType Whether we're analyzing 'video' or 'audio'
 * @returns Estimated seconds remaining
 */
export function estimateTimeRemaining(
  progress: number, 
  startTime: Date,
  durationMinutes?: number, 
  analysisType: AnalysisType = 'video'
): number {
  // If we're at 0% progress, use our duration-based estimate
  if (progress <= 0 && durationMinutes) {
    return estimateProcessingTime(durationMinutes, analysisType);
  }
  
  // Calculate time elapsed so far
  const elapsedMs = new Date().getTime() - startTime.getTime();
  const elapsedSeconds = elapsedMs / 1000;
  
  // If we have accurate duration info, use a hybrid approach
  if (durationMinutes) {
    // Get the model estimate
    const modelEstimate = estimateProcessingTime(durationMinutes, analysisType);
    
    // Calculate percent-based estimate
    const percentBasedEstimate = progress > 0 
      ? (elapsedSeconds / progress) * (100 - progress)
      : modelEstimate;
    
    // As we progress, trust the percent-based estimate more
    const weight = Math.min(progress / 30, 1); // Give more weight after 30% progress
    return Math.round((1 - weight) * modelEstimate + weight * percentBasedEstimate);
  }
  
  // Fallback to simple percent-based estimate if no duration info
  return progress > 0 
    ? Math.round((elapsedSeconds / progress) * (100 - progress))
    : 60; // Default 60 seconds if we have no information
} 