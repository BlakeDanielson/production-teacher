/**
 * Progress Tracker Utility
 * 
 * Provides functionality for real-time progress tracking via WebSocket connection
 */

import { useEffect, useState } from "react";
import { AnalysisType } from '@/types';
import { estimateTimeRemaining } from './timeEstimates';

// Define progress update message type
type ProgressStage = 'validating' | 'downloading' | 'processing' | 'analyzing' | 'analyzing_pending' | 'complete' | 'error';

export interface ProgressUpdate {
  id: string;
  stage: ProgressStage;
  progress: number;
  details?: string;
  estimatedTimeRemaining?: number;
  fileSize?: number;
  startTime?: Date;
  backendTimestamp?: number; // Timestamp from backend events
  backendConfirmed?: boolean; // Whether backend confirmed completion
  videoDurationMinutes?: number;
  type: AnalysisType;
}

// Check if browser environment
const isBrowser = typeof window !== 'undefined';

// Track all active analysis jobs
const activeJobs: Record<string, ProgressUpdate> = {};

// Generate a unique analysis ID
export function generateAnalysisId(): string {
  return 'analysis_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

// Create mock progress updates (for demo - would normally connect to WebSocket)
export function initializeProgressTracking(
  jobId: string, 
  type: AnalysisType,
  videoDurationMinutes?: number
): string {
  if (!isBrowser) return jobId;
  
  // Create a new job object
  activeJobs[jobId] = {
    id: jobId,
    type,
    videoDurationMinutes,
    progress: 0,
    stage: 'validating',
    details: 'Starting analysis...',
    startTime: new Date(),
    estimatedTimeRemaining: videoDurationMinutes 
      ? estimateTimeRemaining(0, new Date(), videoDurationMinutes, type)
      : 60, // Default 60 seconds if no duration info
  };
  
  // Notify subscribers (though there likely aren't any yet)
  notifySubscribers(jobId);
  
  console.log(`Initialized progress tracking for job ${jobId}`);
  
  // Start intercepting fetch calls to track progress
  interceptFetch();
  
  return jobId;
}

// Update job progress and broadcast to subscribers
function updateJobProgress(jobId: string, update: Partial<ProgressUpdate>): void {
  if (!activeJobs[jobId]) return;
  
  // Update active job record
  activeJobs[jobId] = {
    ...activeJobs[jobId],
    ...update
  };
  
  // In a real implementation, this would emit to WebSocket listeners
  // For now, we just trigger custom event on window
  if (isBrowser) {
    const event = new CustomEvent('analysis-progress-update', { 
      detail: activeJobs[jobId]
    });
    window.dispatchEvent(event);
  }
}

// Handle backend response - mark job as complete when API returns
export function confirmJobCompletion(jobId: string, success: boolean = true): void {
  if (!activeJobs[jobId]) return;

  updateJobProgress(jobId, {
    stage: success ? 'complete' : 'error',
    progress: success ? 100 : 0,
    details: success ? 'Analysis complete!' : 'Error during analysis',
    backendConfirmed: true,
    estimatedTimeRemaining: 0
  });
  
  // Clean up after delay
  setTimeout(() => {
    if (activeJobs[jobId]) {
      console.log(`Cleaning up completed job ${jobId}`);
      delete activeJobs[jobId];
    }
  }, 60000); // Keep job data for 1 minute after completion
}

// Cancel an analysis job
export function cancelAnalysis(jobId: string): void {
  if (!activeJobs[jobId]) return;
  
  updateJobProgress(jobId, {
    stage: 'error',
    progress: 0,
    details: 'Analysis cancelled by user',
    backendConfirmed: true
  });
  
  // Clean up after short delay
  setTimeout(() => {
    if (activeJobs[jobId]) {
      console.log(`Cleaning up cancelled job ${jobId}`);
      delete activeJobs[jobId];
    }
  }, 2000);
}

// Get current job progress
export function getJobProgress(jobId: string): ProgressUpdate | null {
  return activeJobs[jobId] || null;
}

// React hook for tracking progress
export function useProgressTracker(jobId: string | null): ProgressUpdate | null {
  const [progress, setProgress] = useState<ProgressUpdate | null>(
    jobId ? getJobProgress(jobId) : null
  );
  
  useEffect(() => {
    if (!isBrowser || !jobId) return;
    
    const handleProgressUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<ProgressUpdate>;
      if (customEvent.detail.id === jobId) {
        setProgress(customEvent.detail);
      }
    };
    
    // Listen for progress updates
    window.addEventListener('analysis-progress-update', handleProgressUpdate);
    
    // Clean up
    return () => {
      window.removeEventListener('analysis-progress-update', handleProgressUpdate);
    };
  }, [jobId]);
  
  return progress;
}

// Monitor for fetch completions to sync with backend
if (isBrowser) {
  const originalFetch = window.fetch;
  
  window.fetch = async function(input, init) {
    // Extract jobId before making the request
    let jobId: string | null = null;
    
    try {
      // Check if this is an analyze request
      if (typeof input === 'string' && input.includes('/api/analyze') && 
          init?.method?.toUpperCase() === 'POST' && init?.body) {
        
        // Extract jobId from request body
        const requestData = JSON.parse(init.body as string);
        jobId = requestData.jobId || null;
      }
    } catch (e) {
      // Ignore parsing errors in body
    }
    
    // Make the actual request
    const result = await originalFetch(input, init);
    
    // Process response for analyze endpoint
    if (jobId && typeof input === 'string' && input.includes('/api/analyze')) {
      // Clone the response so we can read it multiple times
      const clonedResponse = result.clone();
      
      try {
        // Try to parse the response
        const responseData = await clonedResponse.json();
        
        // Confirm completion based on response status
        confirmJobCompletion(jobId, clonedResponse.ok);
        
        // Log success or failure
        if (clonedResponse.ok) {
          console.log(`Backend confirmed completion of job: ${jobId}`);
        } else {
          console.error(`Backend reported error for job: ${jobId}`, responseData.error);
        }
      } catch (e) {
        // If we can't parse the response, still update status based on HTTP status
        confirmJobCompletion(jobId, clonedResponse.ok);
        console.warn(`Could not parse response for job ${jobId}, but marked as ${clonedResponse.ok ? 'complete' : 'error'}`);
      }
    }
    
    return result;
  };
}

// In a real implementation, this would be a WebSocket client connection
// Example for reference (not used in this demo):
/*
let socket: WebSocket | null = null;

function connectWebSocket() {
  if (!isBrowser || socket) return;
  
  socket = new WebSocket('wss://your-websocket-server.com/progress');
  
  socket.onopen = () => {
    console.log('WebSocket connected');
  };
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'progress' && data.jobId) {
      updateJobProgress(data.jobId, data.progress);
    }
  };
  
  socket.onclose = () => {
    socket = null;
    setTimeout(connectWebSocket, 5000); // Reconnect after delay
  };
}
*/

// Update the job with progress information
export function updateProgress(
  jobId: string, 
  stage: ProgressStage, 
  progress: number, 
  details?: string
) {
  if (!activeJobs[jobId]) {
    console.warn(`Attempted to update non-existent job ${jobId}`);
    return;
  }
  
  const job = activeJobs[jobId];
  job.stage = stage;
  job.progress = Math.min(Math.max(0, Math.round(progress)), 100); // Ensure progress is 0-100
  
  if (details) {
    job.details = details;
  }
  
  // Update estimated time remaining using our improved model
  if (job.startTime) {
    const durationMinutes = job.videoDurationMinutes;
    job.estimatedTimeRemaining = estimateTimeRemaining(
      job.progress, 
      job.startTime, 
      durationMinutes, 
      job.type
    );
  }
  
  // Notify all subscribers for this job
  notifySubscribers(jobId);
  
  // Special handling: if we're in the final stages (complete or error), clean up after a delay
  if (stage === 'complete' || stage === 'error') {
    setTimeout(() => {
      if (activeJobs[jobId]) {
        console.log(`Cleaning up completed job ${jobId}`);
        delete activeJobs[jobId];
      }
    }, 60000); // Keep job data for 1 minute after completion
  }
}

// Notify subscribers for a job
function notifySubscribers(jobId: string): void {
  if (isBrowser) {
    const event = new CustomEvent('analysis-progress-update', { 
      detail: activeJobs[jobId]
    });
    window.dispatchEvent(event);
  }
}

// Start intercepting fetch calls to track progress
function interceptFetch(): void {
  if (!isBrowser) return;
  
  const originalFetch = window.fetch;
  
  window.fetch = async function(input, init) {
    // Extract jobId before making the request
    let jobId: string | null = null;
    
    try {
      // Check if this is an analyze request
      if (typeof input === 'string' && input.includes('/api/analyze') && 
          init?.method?.toUpperCase() === 'POST' && init?.body) {
        
        // Extract jobId from request body
        const requestData = JSON.parse(init.body as string);
        jobId = requestData.jobId || null;
      }
    } catch (e) {
      // Ignore parsing errors in body
    }
    
    // Make the actual request
    const result = await originalFetch(input, init);
    
    // Process response for analyze endpoint
    if (jobId && typeof input === 'string' && input.includes('/api/analyze')) {
      // Clone the response so we can read it multiple times
      const clonedResponse = result.clone();
      
      try {
        // Try to parse the response
        const responseData = await clonedResponse.json();
        
        // Confirm completion based on response status
        confirmJobCompletion(jobId, clonedResponse.ok);
        
        // Log success or failure
        if (clonedResponse.ok) {
          console.log(`Backend confirmed completion of job: ${jobId}`);
        } else {
          console.error(`Backend reported error for job: ${jobId}`, responseData.error);
        }
      } catch (e) {
        // If we can't parse the response, still update status based on HTTP status
        confirmJobCompletion(jobId, clonedResponse.ok);
        console.warn(`Could not parse response for job ${jobId}, but marked as ${clonedResponse.ok ? 'complete' : 'error'}`);
      }
    }
    
    return result;
  };
} 