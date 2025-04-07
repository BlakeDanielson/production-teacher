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
  result?: any; // Keep as any for now, or define specific result types per job
} 