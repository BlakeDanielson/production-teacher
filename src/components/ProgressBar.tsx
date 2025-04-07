import React from 'react';

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
  // Calculate the width of the progress bar
  const width = `${Math.min(progress, 100)}%`;
  
  // Determine the color based on state
  let colorClass = 'bg-blue-500';
  if (isComplete) colorClass = 'bg-green-500';
  if (isError) colorClass = 'bg-red-500';
  
  return (
    <div className="w-full mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-300">{status}</span>
        <span className="text-sm font-medium text-gray-300">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        <div 
          className={`h-2.5 rounded-full transition-all duration-300 ${colorClass}`} 
          style={{ width }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar; 