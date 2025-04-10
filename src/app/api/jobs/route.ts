import { NextResponse, type NextRequest } from 'next/server';
import {
  getJob,
  listJobs,
  updateJobStatus,
  deleteJob,
  JobType, // Import JobType
  JobStatus // Import JobStatus
} from '@/lib/jobQueue';

/**
 * GET: Fetch a job by ID or list jobs with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('id');
    
    // If job ID is provided, get that specific job
    if (jobId) {
      const job = await getJob(jobId);
      if (!job) {
        return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
      }
      return NextResponse.json(job);
    }

    // Otherwise, list jobs with optional filters
    const typeParam = searchParams.get('type');
    const statusParam = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Validate typeParam
    let validatedType: JobType | undefined = undefined;
    const allowedTypes: JobType[] = ['transcription', 'analysis', 'download'];
    if (typeParam && allowedTypes.includes(typeParam as JobType)) {
      validatedType = typeParam as JobType;
    }

    // Validate statusParam
    let validatedStatus: JobStatus | undefined = undefined;
    const allowedStatuses: JobStatus[] = ['pending', 'processing', 'completed', 'failed'];
    if (statusParam && allowedStatuses.includes(statusParam as JobStatus)) {
      validatedStatus = statusParam as JobStatus;
    }

    const jobs = await listJobs(validatedType, validatedStatus, limit);
    return NextResponse.json(jobs);

  } catch (error: unknown) {
    console.error("Error in /api/jobs GET:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * PUT: Update a job's status
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, progress, result, error } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }
    
    if (!status) {
      return NextResponse.json({ error: 'Job status is required' }, { status: 400 });
    }
    
    await updateJobStatus(id, status, progress, result, error);
    
    const updatedJob = await getJob(id);
    return NextResponse.json(updatedJob);
    
  } catch (error: unknown) {
    console.error("Error in /api/jobs PUT:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE: Delete a job
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('id');
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }
    
    await deleteJob(jobId);
    
    return NextResponse.json({ success: true, message: `Job ${jobId} deleted` });
    
  } catch (error: unknown) {
    console.error("Error in /api/jobs DELETE:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
