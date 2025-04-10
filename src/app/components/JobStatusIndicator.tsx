import { useState, useEffect } from 'react';
import { Job } from '@/lib/jobQueue';

interface JobStatusIndicatorProps {
  jobId: string;
  onCompleted?: (result: string) => void;
  onFailed?: (error: string) => void;
  showDetails?: boolean;
  className?: string;
  pollingInterval?: number; // in milliseconds
}

export default function JobStatusIndicator({
  jobId,
  onCompleted,
  onFailed,
  showDetails = false,
  className = '',
  pollingInterval = 2000,
}: JobStatusIndicatorProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  // Polling function to check job status
  useEffect(() => {
    if (!jobId || !isPolling) return;

    const checkJobStatus = async () => {
      try {
        const response = await fetch(`/api/jobs?id=${jobId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch job status: ${response.statusText}`);
        }
        
        const jobData = await response.json();
        setJob(jobData);
        
        // Handle job completion or failure
        if (jobData.status === 'completed') {
          setIsPolling(false);
          // Provide default empty string if result is null
          if (onCompleted) onCompleted(jobData.result ?? ''); 
        } else if (jobData.status === 'failed') {
          setIsPolling(false);
          // Provide default message if error is null
          if (onFailed) onFailed(jobData.error ?? 'Job failed with no specific error message');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error checking job status');
        setIsPolling(false);
      }
    };

    // Run immediately and then set up interval
    checkJobStatus();
    const intervalId = setInterval(checkJobStatus, pollingInterval);
    
    // Cleanup
    return () => clearInterval(intervalId);
  }, [jobId, isPolling, onCompleted, onFailed, pollingInterval]);

  // Return early if no job data
  if (!job) {
    return (
      <div className={`flex items-center ${className}`}>
        {error ? (
          <div className="text-red-500">Error: {error}</div>
        ) : (
          <div className="flex items-center">
            <div className="animate-spin mr-2 h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            <span>Loading job status...</span>
          </div>
        )}
      </div>
    );
  }

  // Generate status color based on job status
  const getStatusColor = () => {
    switch (job.status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'processing': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  // Format the timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Determine the status message
  const getStatusMessage = () => {
    // job.result is typed as string | undefined in the Job interface.
    // Accessing a 'message' property is incorrect here.
    switch (job.status) {
      case 'pending':
        return 'Waiting to start...';
      case 'processing':
        // Simply return a standard processing message.
        // Progress is shown separately via the progress bar.
        return 'Processing...';
      case 'completed':
        return 'Completed successfully';
      case 'failed':
        return `Failed: ${job.error || 'Unknown error'}`;
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className={`${className} rounded-md border p-3`}>
      <div className="flex items-center">
        <div className={`${getStatusColor()} h-3 w-3 rounded-full mr-2`}></div>
        <div className="flex-1">
          <div className="flex justify-between">
            {/* Display job type, handle potential null */}
            <span className="font-medium">Job: {job.type ?? 'N/A'}</span> 
            {/* Use created_at as fallback if updated_at is null */}
            <span className="text-sm text-gray-500">{formatTime(job.updated_at ?? job.created_at)}</span>
          </div>
          <p className="text-sm mt-1">{getStatusMessage()}</p>
        </div>
      </div>
      
      {job.progress !== undefined && job.status === 'processing' && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-in-out" 
              style={{ width: `${job.progress}%` }}
            ></div>
          </div>
          <div className="text-xs mt-1 text-right">{job.progress}%</div>
        </div>
      )}
      
      {showDetails && (
        <div className="mt-3 text-xs text-gray-500">
          <p>ID: {job.id}</p>
          <p>Created: {formatTime(job.created_at)}</p>
          {job.error && <p className="text-red-500 mt-1">Error: {job.error}</p>}
        </div>
      )}
    </div>
  );
}
