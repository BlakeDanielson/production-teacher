import React, { useState, useEffect } from 'react';
import ProgressBar from './ProgressBar';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, InfoIcon } from 'lucide-react';

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
  
  // Get status indicator components
  const getStatusIcon = () => {
    if (!jobStatus) return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
    
    switch (jobStatus.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'processing':
      case 'created':
      default:
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    }
  };
  
  const getStatusBadge = () => {
    if (!jobStatus) return (
      <Badge variant="outline" className="bg-muted/50">
        Initializing
      </Badge>
    );
    
    switch (jobStatus.status) {
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Completed</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Failed</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Processing</Badge>;
      case 'created':
      default:
        return <Badge variant="outline" className="bg-muted/50">Created</Badge>;
    }
  };
  
  if (!jobStatus) {
    return (
      <Card className="my-4 bg-card/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Initializing job...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="my-4 bg-card/50 smooth-transition">
      <CardHeader className="pb-2 pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getStatusIcon()}
            <span>
              {jobStatus.status === 'completed' ? 'Job Complete' : 
               jobStatus.status === 'failed' ? 'Job Failed' :
               'Processing...'}
            </span>
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <ProgressBar 
          progress={jobStatus.progress || 0}
          status={jobStatus.message || jobStatus.status}
          isComplete={jobStatus.status === 'completed'}
          isError={jobStatus.status === 'failed'}
        />
      </CardContent>
      
      {jobStatus.error && (
        <CardFooter className="pt-2 pb-6">
          <Alert variant="destructive" className="w-full">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2 text-sm">
              {jobStatus.error}
            </AlertDescription>
          </Alert>
        </CardFooter>
      )}
    </Card>
  );
};

export default JobStatusDisplay; 