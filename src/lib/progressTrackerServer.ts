/**
 * Progress Tracker Server Utility
 * 
 * Provides functionality for server-side progress tracking operations
 */

import { AnalysisType } from '@/types';

// Define progress update message type
export type ProgressStage = 'validating' | 'downloading' | 'processing' | 'analyzing' | 'analyzing_pending' | 'complete' | 'error';

export interface ProgressUpdate {
  id: string;
  stage: ProgressStage;
  progress: number;
  details?: string;
  estimatedTimeRemaining?: number;
  fileSize?: number;
  startTime?: Date;
  backendTimestamp?: number; 
  backendConfirmed?: boolean;
  videoDurationMinutes?: number;
  type: AnalysisType;
}

// Generate a unique analysis ID - safe for server use
export function generateAnalysisId(): string {
  return 'analysis_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

// Simple update progress function for server use
export function updateProgress(
  jobId: string, 
  stage: ProgressStage, 
  progress: number, 
  details?: string
): void {
  // On the server, we just log the progress
  console.log(`[Server] Progress update for job ${jobId}: ${stage} (${progress}%) - ${details || 'No details'}`);
} 