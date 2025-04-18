/**
 * Simple Job Queue Management System
 * 
 * This file provides utilities for tracking long-running asynchronous jobs
 * like transcription and analysis operations.
 */

import { supabase } from './supabaseClient';

// Types for job status tracking
export type JobType = 'transcription' | 'analysis' | 'download';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  progress?: number;
  result?: string | null;
  error?: string | null;
  created_at: string;
  updated_at: string | null;
  metadata?: Record<string, unknown> | null; // Use unknown instead of any
  youtube_url?: string | null;
  analysis_type?: string | null; // Match text type
  user_id?: string | null; // Match uuid type
}

/**
 * Create a new job in the jobs table
 * 
 * @param type The type of job being performed
 * @param metadata Additional metadata to store with the job
 * @returns The created job record
 */
// Use unknown for metadata type
export async function createJob(type: JobType, metadata: Record<string, unknown> = {}): Promise<Job> {
  // Extract specific fields expected in the table from the metadata object
  // We might need type assertions here if accessing specific properties later
  const { youtubeUrl, analysisType, userId, ...otherMetadata } = metadata;

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      type: type, // The job type ('analysis', 'transcription', etc.)
      status: 'pending', // Default status
      youtube_url: youtubeUrl, // Insert into the specific column
      analysis_type: analysisType, // Insert into the specific column
      user_id: userId, // Insert user_id if provided in metadata
      metadata: otherMetadata // Insert remaining metadata into the jsonb column
    })
    .select('*') // Select all columns to match the Job interface
    .single();

  if (error) {
    console.error('Error creating job:', error);
    // Log the detailed error
    console.error('Detailed Supabase insert error:', error);
    throw new Error(`Failed to create job: ${error.message}`);
  }

  // Ensure the returned data matches the Job interface structure
  // You might need to adjust the Job interface or the select statement
  // if the table columns don't perfectly align with the interface fields.
  return data as Job;
}

/**
 * Update a job's status and optional progress
 * 
 * @param jobId The ID of the job to update
 * @param status The new status
 * @param progress Optional progress percentage (0-100)
 * @param result Optional result data
 * @param error Optional error message if job failed
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  progress?: number,
  result?: string, // Match the Job interface type
  error?: string
): Promise<void> {
  // Use Partial<Job> for better type safety, aligning with the Job interface
  const updates: Partial<Job> = { status, updated_at: new Date().toISOString() };

  if (progress !== undefined) updates.progress = progress;
  if (result !== undefined) updates.result = result;
  if (error !== undefined) updates.error = error;
  
  const { error: updateError } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', jobId);
  
  if (updateError) {
    console.error('Error updating job status:', updateError);
    throw new Error(`Failed to update job status: ${updateError.message}`);
  }
}

/**
 * Get a job by its ID
 * 
 * @param jobId The ID of the job to retrieve
 * @returns The job record or null if not found
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') { // Record not found error code
      return null;
    }
    console.error('Error fetching job:', error);
    throw new Error(`Failed to fetch job: ${error.message}`);
  }
  
  return data as Job;
}

/**
 * List jobs with optional filtering
 * 
 * @param type Optional job type to filter by
 * @param status Optional job status to filter by
 * @param limit Maximum number of jobs to return
 * @returns Array of jobs matching the criteria
 */
export async function listJobs(
  type?: JobType,
  status?: JobStatus,
  limit = 10
): Promise<Job[]> {
  let query = supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (type) {
    query = query.eq('type', type);
  }
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error listing jobs:', error);
    throw new Error(`Failed to list jobs: ${error.message}`);
  }
  
  return data as Job[];
}

/**
 * Delete a job by its ID
 * 
 * @param jobId The ID of the job to delete
 */
export async function deleteJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', jobId);
  
  if (error) {
    console.error('Error deleting job:', error);
    throw new Error(`Failed to delete job: ${error.message}`);
  }
}

/**
 * Start processing a job and update its status
 * 
 * @param jobId The ID of the job to process
 * @param processFunction Async function that performs the actual processing
 * @returns The result of the processing function
 */
export async function processJob<T>(
  jobId: string,
  processFunction: () => Promise<T>
): Promise<T> {
  try {
    // Update job status to processing
    await updateJobStatus(jobId, 'processing');
    
    // Execute the process function
    const result = await processFunction();
    
    // Convert result to string (e.g., JSON) before storing
    const resultString = typeof result === 'string' ? result : JSON.stringify(result);
    
    // Update job status to completed with the stringified result
    await updateJobStatus(jobId, 'completed', 100, resultString);
    
    return result;
  } catch (error) {
    // Update job status to failed with error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateJobStatus(jobId, 'failed', undefined, undefined, errorMessage);
    
    throw error;
  }
}
