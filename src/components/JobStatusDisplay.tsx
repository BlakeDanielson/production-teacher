import React, { useState, useEffect } from 'react';
import ProgressBar from './ProgressBar';

interface JobStatus {
  id: string;
  status: 'created' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  error?: string;
  result?: any;
}

interface JobStatusDisplayProps {
  jobId: string | null;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  pollingInterval?: number;
}

const JobStatusDisplay: React.FC<JobStatusDisplayProps> = ({
  jobId,
  onComplete,
  onError,
  pollingInterval = 1500 // Default polling interval: 1.5 seconds
}) => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    // Reset state when job ID changes
    if (jobId) {
      setJobStatus(null);
      setIsPolling(true);
      setHasFailed(false);
    } else {
      setIsPolling(false);
    }
  }, [jobId]);

  // Job status polling effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const fetchJobStatus = async () => {
      if (!jobId || !isPolling) return;

      try {
        const response = await fetch(`/api/job-status?id=${jobId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch job status: ${response.statusText}`);
        }
        
        const data = await response.json();
        setJobStatus(data);
        
        if (data.status === 'completed') {
          setIsPolling(false);
          if (onComplete) onComplete(data.result);
        } 
        else if (data.status === 'failed') {
          setIsPolling(false);
          setHasFailed(true);
          if (onError) onError(data.error || 'Job failed without specific error message');
        }
      } catch (error) {
        console.error('Error fetching job status:', error);
        // Don't stop polling on network errors - it might recover
      }
    };

    if (isPolling && jobId) {
      // Initial fetch
      fetchJobStatus();
      
      // Set up interval for subsequent fetches
      intervalId = setInterval(fetchJobStatus, pollingInterval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, isPolling, pollingInterval, onComplete, onError]);

  if (!jobId) return null;
  
  if (!jobStatus) {
    return (
      <div className="my-4 p-4 bg-gray-800 rounded-md">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div>
          <p className="text-sm text-gray-300">Initializing job...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 p-4 bg-gray-800 rounded-md">
      <h3 className="text-lg font-medium text-gray-300 mb-2">
        {jobStatus.status === 'completed' ? 'Job Complete' : 
         jobStatus.status === 'failed' ? 'Job Failed' :
         'Processing...'}
      </h3>
      
      <ProgressBar 
        progress={jobStatus.progress || 0}
        status={jobStatus.message || jobStatus.status}
        isComplete={jobStatus.status === 'completed'}
        isError={jobStatus.status === 'failed'}
      />
      
      {jobStatus.error && (
        <div className="mt-2 p-3 bg-red-900/30 border border-red-800 rounded-md">
          <p className="text-red-400 text-sm">{jobStatus.error}</p>
        </div>
      )}
    </div>
  );
};

export default JobStatusDisplay; 