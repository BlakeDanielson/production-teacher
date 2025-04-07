import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('id');

    if (!jobId) {
      return NextResponse.json({ error: 'No job ID provided' }, { status: 400 });
    }

    // Query the jobs table to get the current status
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('Error fetching job status:', error);
      return NextResponse.json({ error: `Failed to fetch job status: ${error.message}` }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if we need to fetch additional details based on job type and status
    let result = null;

    if (job.status === 'completed') {
      // For transcription jobs, fetch the transcription
      if (job.job_type === 'transcription' && job.metadata?.transcription_id) {
        const { data: transcription, error: transcriptionError } = await supabase
          .from('transcriptions')
          .select('*')
          .eq('id', job.metadata.transcription_id)
          .single();

        if (!transcriptionError && transcription) {
          result = {
            ...transcription,
            type: 'transcription'
          };
        }
      }
      // Handle other job types similarly if needed
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      job_type: job.job_type,
      progress: job.progress || 0,
      message: job.status_message,
      created_at: job.created_at,
      updated_at: job.updated_at,
      error: job.error_message,
      result: result
    });

  } catch (error: unknown) {
    console.error('Error in /api/job-status:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 