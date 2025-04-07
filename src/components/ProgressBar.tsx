import React from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  progress: number;
  status: string;
  isComplete?: boolean;
  isError?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  status, 
  isComplete = false,
  isError = false
}) => {
  // Ensure progress is within bounds
  const normalizedProgress = Math.min(Math.max(0, progress), 100);
  
  // Determine style based on state
  const progressClass = isComplete 
    ? 'bg-green-500' 
    : isError 
      ? 'bg-red-500' 
      : '';
  
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{status}</span>
        <span className="text-sm font-medium text-foreground">{Math.round(normalizedProgress)}%</span>
      </div>
      
      {/* Custom progress bar since we need to change the color dynamically */}
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-300", progressClass || "bg-primary")}
          style={{ width: `${normalizedProgress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar; 