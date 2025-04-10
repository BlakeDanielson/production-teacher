// Shared type definitions for the application

// Analysis Types
export type AnalysisType = 'video' | 'audio';
export type AnalysisModel = 'gemini' | 'gpt4';

// Transcription Types
export type TranscriptionQuality = 'low' | 'medium' | 'high';
export type TranscriptionFormat = 'mp3' | 'wav' | 'm4a';

// Report Metadata (from API/DB)
export interface ReportMetadata {
  id: string;
  youtube_url: string;
  analysis_type: AnalysisType; // Use shared type
  created_at: string;
  // Optionally add report_content_preview or other relevant fields from your DB
}

// Job Status (from API)
export interface JobStatus {
  id: string;
  status: 'created' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  error?: string;
  // TODO: Define specific result types based on job type (e.g., TranscriptionResult | AnalysisResult)
  // Left as 'any' for now as the structure varies depending on the completed job.
  // TODO: Define specific result types based on job type (e.g., TranscriptionResult | AnalysisResult)
  // Using a specific type for transcription results now. Might need a union type later.
  result?: TranscriptionResultPayload; // Keep 'any' for now for other potential job types
}

// Specific payload type for completed transcription jobs
export interface TranscriptionResultPayload {
  content?: string; // The transcribed text
  // Add other potential fields from the transcription result if known
}
