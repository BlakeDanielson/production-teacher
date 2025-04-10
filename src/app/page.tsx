"use client"; // Required for useState and event handlers

import { useState, useEffect } from "react"; // Added useEffect
import ReactMarkdown from "react-markdown";
import { keyframes } from '@emotion/react';

// Mantine components
import {
  Button, Card, Alert, Text, Title, Group, Stack, // Removed TextInput, Loader
  Paper, Center, Image, Badge, // Removed Container, SimpleGrid, AspectRatio, Divider
  ThemeIcon, Progress, Timeline, RingProgress, Tooltip // Removed Space
} from '@mantine/core';
import { notifications } from '@mantine/notifications'; // Corrected import path
import { IconAlertTriangle, IconPlayerPlay, IconMusic, IconSearch, IconDeviceFloppy, IconCheck, IconX, IconDownload, IconPlayerRecord, IconCloudComputing, IconFileAnalytics, IconCheck as IconCheckmark, IconClock, IconPlayerStop } from '@tabler/icons-react'; // Removed IconFileCheck, IconInfoCircle

// Import shared types
import { AnalysisType } from '@/types'; // Removed ReportMetadata
import { useAppStore } from '@/store/store'; // Import the store
import { generateAnalysisId, initializeProgressTracking, cancelAnalysis, useProgressTracker } from '@/lib/progressTracker';
import { YoutubeInput } from './components/YoutubeInput';

// Constants for warnings
const VIDEO_LENGTH_WARNING_MINUTES = 15; // Example: warn if video is longer than 15 minutes
const AUDIO_LENGTH_WARNING_MINUTES = 30; // Warn for audio longer than 30 minutes

// Removed unused local types: TranscriptionQuality, TranscriptionFormat, AnalysisModel

// Define animations
const pulseOpacity = keyframes`
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
`;

const pulseShadow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(250, 220, 95, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(250, 220, 95, 0); }
  100% { box-shadow: 0 0 0 0 rgba(250, 220, 95, 0); }
`;

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisTypeForSave, setAnalysisTypeForSave] = useState<AnalysisType | null>(null);
  
  // Replace the analysisStatus state with a currentJobId state and use the hook
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const analysisStatus = useProgressTracker(currentJobId);
  
  // New state variables
  const [videoInfo, setVideoInfo] = useState<{ 
    id?: string;
    title?: string; 
    duration?: number;
    thumbnailUrl?: string;
  } | null>(null);
  const [showSizeWarning, setShowSizeWarning] = useState(false);
  
  // Use abortController from useState
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Get API keys from store
  const { googleApiKey } = useAppStore(); // Removed unused openaiApiKey

  // Fetch reports on component mount - REMOVED (will be on reports page)
  // useEffect(() => { fetchReports(); }, []);

  const handleYoutubeValidation = (isValid: boolean, info?: { id: string; title?: string; thumbnailUrl?: string; duration?: number }) => {
    if (isValid && info) {
      setVideoInfo({
        id: info.id,
        title: info.title,
        thumbnailUrl: info.thumbnailUrl,
        duration: info.duration
      });
      setShowSizeWarning(false);
      setError(null);
      
      // Only show size warning if we have a real duration and it exceeds our threshold
      if (info.duration && info.duration > VIDEO_LENGTH_WARNING_MINUTES) {
        setShowSizeWarning(true);
      }
    } else {
      setVideoInfo(null); // Clear info if invalid
      setShowSizeWarning(false);
      if (!isValid && youtubeUrl) setError("Invalid YouTube URL"); 
      else setError(null);
    }
  };

  // Update the cancel function to use the tracker
  const handleCancelAnalysis = () => {
    if (currentJobId) {
      // Cancel in the progress tracker
      cancelAnalysis(currentJobId);
      
      // Also abort the fetch if it's in progress
      if (abortController) {
        abortController.abort();
      }
      
      setError('Analysis cancelled by user');
      
      // Reset after a short delay
      setTimeout(() => {
        setIsLoading(false);
        setCurrentJobId(null);
      }, 2000);
    }
  };

  // Removed unused function calculateEstimatedTimeRemaining

  // Format time remaining in a readable format
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${seconds} sec remaining`;
    if (seconds < 3600) {
      const min = Math.floor(seconds / 60);
      const sec = seconds % 60;
      return `${min} min ${sec} sec remaining`;
    }
    const hrs = Math.floor(seconds / 3600);
    const min = Math.floor((seconds % 3600) / 60);
    return `${hrs} hr ${min} min remaining`;
  };

  const handleAnalyze = async (type: AnalysisType) => {
    if (!youtubeUrl) {
      setError("Please enter a YouTube URL.");
      return;
    }
    
    if (!googleApiKey) {
      setError("Missing Google Gemini API Key. Please set it in the Settings page.");
      return;
    }
    
    // If analyzing a video that's too long, show confirmation
    if (type === 'video' && videoInfo?.duration && videoInfo.duration > VIDEO_LENGTH_WARNING_MINUTES) {
      if (!confirm(`This video appears to be ${videoInfo.duration} minutes long, which might exceed Gemini's file size limits. Full video analysis might fail. Continue anyway?\n\nTip: Try audio-only analysis for long videos.`)) {
        return;
      }
    }
    // If analyzing audio that's very long, show a milder warning
    else if (type === 'audio' && videoInfo?.duration && videoInfo.duration > AUDIO_LENGTH_WARNING_MINUTES) {
      if (!confirm(`This audio is ${videoInfo.duration} minutes long, which might take longer to process. Continue?`)) {
        return;
      }
    }
    
    // Create an AbortController for this request
    const controller = new AbortController();
    setAbortController(controller);
    
    // Create job ID and start progress tracking
    const jobId = generateAnalysisId();
    setCurrentJobId(jobId);
    initializeProgressTracking(jobId, type, videoInfo?.duration);
    
    setIsLoading(true);
    setError(null);
    setReportContent(null);
    setAnalysisTypeForSave(null);

    try {      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          youtubeUrl, 
          analysisType: type,
          googleApiKey,
          jobId // Pass the job ID to track progress
        }),
        signal: controller.signal
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      setReportContent(data.reportContent);
      setAnalysisTypeForSave(type);

      // Save analysis to history in localStorage
      if (isBrowser) {
        try {
          const analysisHistory = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
          analysisHistory.push({
            date: new Date().toISOString(),
            url: youtubeUrl,
            title: videoInfo?.title || 'Untitled Video',
            type,
            durationSeconds: Math.round((new Date().getTime() - (analysisStatus?.startTime?.getTime() || Date.now())) / 1000),
            fileSize: analysisStatus?.fileSize
          });
          // Keep only the last 10 analyses
          if (analysisHistory.length > 10) analysisHistory.shift();
          localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory));
        } catch (e) {
          console.error("Could not save analysis history:", e);
        }
      }

    } catch (err) {
      console.error("Error calling analyze API:", err);
      
      // Check if this was an abort error
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Analysis cancelled by user');
      } else {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    } finally {
      setAbortController(null);
      
      // Reset loading after a delay when complete
      if (analysisStatus?.stage === 'complete' || analysisStatus?.stage === 'error') {
        setTimeout(() => {
          setIsLoading(false);
          setCurrentJobId(null);
        }, 3000);
      }
    }
  };

  const handleSaveReport = async () => {
    if (!reportContent || !analysisTypeForSave || !youtubeUrl) {
      notifications.show({ title: 'Error', message: 'Cannot save report: Missing data', color: 'red' });
      return;
    }
    // Indicate saving is in progress (optional)
    const savingNotificationId = notifications.show({
      loading: true,
      title: 'Saving Report',
      message: 'Please wait...',
      autoClose: false,
      withCloseButton: false,
    });

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl: youtubeUrl,
          analysisType: analysisTypeForSave,
          reportContent: reportContent,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save report');
      }
      
      notifications.update({
        id: savingNotificationId,
        color: 'green',
        title: 'Success',
        message: 'Report saved successfully!',
        icon: <IconCheck size={16} />,
        loading: false,
        autoClose: 5000,
        withCloseButton: true,
      });
      
      // Clear the current report view after successful save
      setReportContent(null); 
      setAnalysisTypeForSave(null);
      // Fetch reports to see the updated list
      await useAppStore.getState().fetchReports();

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Could not save the report.";
      notifications.update({
        id: savingNotificationId,
        color: 'red',
        title: 'Save Failed',
        message: errorMsg,
        icon: <IconX size={16} />,
        loading: false,
        autoClose: 7000,
        withCloseButton: true,
      });
      setError(errorMsg); // Keep setting local error if needed
    }
  };

  // URL validation effect with debounce - replaced with YouTubeInput component
  // useEffect(() => {
  //  // Only validate the URL, don't fetch reports here
  //  const timer = setTimeout(() => {
  //    if (youtubeUrl) {
  //      handleYoutubeValidation(true, { id: '', title: '', thumbnailUrl: '', duration: 0 });
  //    }
  //  }, 500); // 500ms debounce
  //  
  //  return () => clearTimeout(timer);
  // }, [youtubeUrl]);

  // Helper function to render stage icon
  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'validating': return <IconSearch size={18} />;
      case 'downloading': return <IconDownload size={18} />;
      case 'processing': return <IconPlayerRecord size={18} />;
      case 'analyzing': return <IconCloudComputing size={18} />;
      case 'analyzing_pending': return <IconCloudComputing size={18} />;
      case 'complete': return <IconCheckmark size={18} />;
      case 'error': return <IconX size={18} />;
      default: return <IconFileAnalytics size={18} />;
    }
  };

  // Helper to check if code is running in browser environment
  const isBrowser = typeof window !== 'undefined';

  // Add a useEffect to set up a timeout for handling long-running analyses
  useEffect(() => {
    // Handle analyzing_pending stage specially - it means we're waiting for backend confirmation
    if (analysisStatus?.stage === 'analyzing_pending') {
      // If we're in pending state for more than 20 seconds, show a note
      const longRunningTimer = setTimeout(() => {
        if (analysisStatus?.stage === 'analyzing_pending') {
          notifications.show({
            title: 'Analysis Taking Longer Than Expected',
            message: 'Large videos/complex analyses may take several minutes. Please be patient.',
            color: 'blue',
            autoClose: false
          });
        }
      }, 20000);
      
      return () => clearTimeout(longRunningTimer);
    }
  }, [analysisStatus?.stage]);

  return (
    <Stack gap="xl">
      {/* Section Title */}
      <div>
        <Title order={2}>YouTube Video Analysis</Title>
        <Text c="dimmed" size="sm">
          Analyze YouTube videos for content insights and production quality feedback.
        </Text>
      </div>

      {/* Input Card */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
          <YoutubeInput
            value={youtubeUrl}
            onChange={setYoutubeUrl}
            onValidation={handleYoutubeValidation}
            isDisabled={isLoading}
            error={error === "Invalid YouTube URL" ? error : undefined}
          />
          
          {videoInfo && videoInfo.thumbnailUrl && (
            <Paper p="sm" radius="sm" withBorder>
              <Group wrap="nowrap">
                <Image
                  src={videoInfo.thumbnailUrl}
                  alt={videoInfo.title || 'Video thumbnail'}
                  radius="sm"
                  h={60}
                  w="auto"
                  fit="contain"
                />
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={500} truncate>
                    {videoInfo.title || 'YouTube Video'}
                  </Text>
                  {videoInfo.duration && (
                    <Text size="xs" c="dimmed">
                      Duration: ~{videoInfo.duration} min
                    </Text>
                  )}
                  {videoInfo.id && <Badge size="sm" variant="light" mt={4}>ID: {videoInfo.id.substring(0, 6)}...</Badge>}
                </div>
              </Group>
            </Paper>
          )}

          {showSizeWarning && (
            <Alert 
              variant="light" 
              color="yellow" 
              title="Length Warning" 
              icon={<IconAlertTriangle size={16} />}
              radius="sm"
              fz="xs"
            >
              Video length might exceed limits for full analysis. Consider Audio Only.
            </Alert>
          )}
          
          {error && error !== "Invalid YouTube URL" && (
            <Alert variant="light" color="red" title="Error" icon={<IconAlertTriangle size={16}/>} radius="sm" fz="xs">
              {error}
            </Alert>
          )}
        </Stack>

        <Group justify="center" mt="lg">
          <Button
            leftSection={<IconPlayerPlay size={16}/>}
            onClick={() => handleAnalyze('video')}
            disabled={isLoading || !youtubeUrl}
            loading={isLoading && analysisTypeForSave === 'video'}
            variant="gradient"
            gradient={{ from: 'violet', to: 'pink', deg: 90 }}
            size="sm"
          >
            Analyze Full Video
          </Button>
          
          <Button
            leftSection={<IconMusic size={16}/>}
            onClick={() => handleAnalyze('audio')}
            disabled={isLoading || !youtubeUrl}
            loading={isLoading && analysisTypeForSave === 'audio'}
            variant="light"
            color="pink"
            size="sm"
          >
            Analyze Audio Only
          </Button>
        </Group>
      </Card>

      {/* Results Card */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="lg">
          <Title order={4}>Analysis Report</Title>
          {reportContent && !isLoading && (
            <Button
              leftSection={<IconDeviceFloppy size={14}/>}
              onClick={handleSaveReport}
              size="xs"
              variant="outline"
              color="green"
            >
              Save Report
            </Button>
          )}
        </Group>
        
        <Paper p="md" radius="sm" bg="dark.8" mih={200} withBorder>
          {isLoading && analysisStatus && ( // analysisStatus comes from useProgressTracker hook
            <Stack gap="md" py="md" justify="center" mih={200}>
              <Group justify="center" gap="xl">
                <RingProgress
                  size={90}
                  thickness={8}
                  roundCaps
                  sections={[{ 
                    value: analysisStatus.progress, 
                    color: analysisStatus.stage === 'error' 
                      ? 'red' 
                      : analysisStatus.stage === 'complete' 
                        ? 'green' 
                        : analysisStatus.stage === 'analyzing_pending' 
                          ? 'yellow' 
                          : 'violet' 
                  }]}
                  label={
                    <Center>
                      <ThemeIcon 
                        color={
                          analysisStatus.stage === 'error' 
                            ? 'red' 
                            : analysisStatus.stage === 'complete' 
                              ? 'green' 
                              : analysisStatus.stage === 'analyzing_pending' 
                                ? 'yellow' 
                                : 'violet'
                        } 
                        variant="light" 
                        radius="xl" 
                        size={40}
                        style={{
                          animation: analysisStatus.stage === 'analyzing_pending' ? `${pulseShadow} 2s infinite` : 'none',
                        }}
                      >
                        {getStageIcon(analysisStatus.stage)}
                      </ThemeIcon>
                    </Center>
                  }
                />
                
                <div style={{ flex: 1 }}>
                  <Group mb={5} justify="apart">
                    <Group gap={5}>
                      <Text fw={500} size="sm">
                        {analysisStatus.stage.charAt(0).toUpperCase() + analysisStatus.stage.slice(1)}
                      </Text>
                      {analysisStatus.fileSize && (
                        <Tooltip label="Estimated file size">
                          <Badge variant="outline" size="xs" color="gray">~{analysisStatus.fileSize} MB</Badge>
                        </Tooltip>
                      )}
                    </Group>
                    <Group gap={8}>
                      {analysisStatus.estimatedTimeRemaining !== undefined && 
                       analysisStatus.stage !== 'complete' && 
                       analysisStatus.stage !== 'error' && (
                        <Group gap={4}>
                          <IconClock size={14} />
                          <Text size="xs" c="dimmed">{formatTimeRemaining(analysisStatus.estimatedTimeRemaining)}</Text>
                        </Group>
                      )}
                      <Badge variant="light" color={analysisStatus.stage === 'error' ? 'red' : analysisStatus.stage === 'complete' ? 'green' : 'violet'}>
                        {analysisStatus.progress}%
                      </Badge>
                      {analysisStatus.stage !== 'complete' && analysisStatus.stage !== 'error' && (
                        <Tooltip label="Cancel analysis">
                          <ThemeIcon 
                            color="red" 
                            variant="light" 
                            radius="xl" 
                            size={22}
                            style={{ cursor: 'pointer' }}
                            onClick={handleCancelAnalysis}
                          >
                            <IconPlayerStop size={12} />
                          </ThemeIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Group>
                  
                  <Progress 
                    value={analysisStatus.progress} 
                    size="sm" 
                    radius="xl"
                    color={analysisStatus.stage === 'error' ? 'red' : analysisStatus.stage === 'complete' ? 'green' : 'violet'}
                    striped={analysisStatus.stage !== 'complete' && analysisStatus.stage !== 'error'}
                    animated={analysisStatus.stage !== 'complete' && analysisStatus.stage !== 'error'}
                  />
                  
                  <Text size="xs" c="dimmed" mt={5}>
                    {analysisStatus.details || 'Processing...'}
                  </Text>
                </div>
              </Group>
              
              <Timeline active={
                analysisStatus.stage === 'validating' ? 0 :
                analysisStatus.stage === 'downloading' ? 1 :
                analysisStatus.stage === 'processing' ? 2 :
                analysisStatus.stage === 'analyzing' || analysisStatus.stage === 'analyzing_pending' ? 3 :
                analysisStatus.stage === 'complete' ? 4 : 0
              } bulletSize={24} lineWidth={2}>
                <Timeline.Item bullet={<IconSearch size={12} />} title="Validating">
                  <Text c="dimmed" size="xs">Checking YouTube URL and content availability</Text>
                </Timeline.Item>
                
                <Timeline.Item bullet={<IconDownload size={12} />} title="Downloading">
                  <Text c="dimmed" size="xs">Retrieving media content from YouTube</Text>
                </Timeline.Item>
                
                <Timeline.Item bullet={<IconPlayerRecord size={12} />} title="Processing">
                  <Text c="dimmed" size="xs">Preparing media for AI analysis</Text>
                </Timeline.Item>
                
                <Timeline.Item 
                  bullet={<IconCloudComputing size={12} />} 
                  title={
                    <Group gap={6}>
                      <Text>Analyzing</Text>
                      {analysisStatus.stage === 'analyzing_pending' && (
                        <Badge 
                          size="xs" 
                          color="yellow"
                          style={{
                            animation: analysisStatus.stage === 'analyzing_pending' ? `${pulseOpacity} 2s infinite` : 'none'
                          }}
                        >
                          finalizing
                        </Badge>
                      )}
                    </Group>
                  }
                >
                  <Text c="dimmed" size="xs">
                    {analysisStatus.stage === 'analyzing_pending' 
                      ? 'Finalizing analysis results. This may take a few minutes for long videos.'
                      : 'Running AI analysis on content'}
                  </Text>
                </Timeline.Item>
                
                <Timeline.Item bullet={<IconCheckmark size={12} />} title="Complete">
                  <Text c="dimmed" size="xs">Finished processing results</Text>
                </Timeline.Item>
              </Timeline>
            </Stack>
          )}
          
          {reportContent && !error && (
            <ReactMarkdown
              components={{
                h1: ({ ...props }) => <Title order={3} my="sm" {...props} />, // Removed unused _node prop
                h2: ({ ...props }) => <Title order={4} my="sm" {...props} />, // Removed unused _node prop
                h3: ({ ...props }) => <Title order={5} my="xs" {...props} />, // Removed unused _node prop
                p: ({ ...props }) => <Text size="sm" mb="xs" {...props} />, // Removed unused _node prop
                a: ({ ...props }) => <Text component="a" c="pink.4" td="underline" {...props} />, // Removed unused _node prop
                li: ({ ...props }) => <Text component="li" size="sm" {...props} /> // Removed unused _node prop
              }}
            >
              {reportContent}
            </ReactMarkdown>
          )}
          
          {!isLoading && !error && !reportContent && (
            <Center style={{ height: '200px', flexDirection: 'column' }}>
              <ThemeIcon variant="light" size={50} radius="xl" mb="md" color="gray">
                <IconSearch size={28} />
              </ThemeIcon>
              <Text c="dimmed" size="sm">Enter a URL and click Analyze to see the report here.</Text>
            </Center>
          )}
        </Paper>
      </Card>

      {/* Analysis History Card */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Recent Analyses</Title>
        
        <AnalysisHistoryList />
      </Card>
    </Stack>
  );
}

// Create a component for showing analysis history
function AnalysisHistoryList() {
  const [history, setHistory] = useState<Array<{
    date: string;
    url: string;
    title?: string;
    type: AnalysisType;
    durationSeconds: number;
    fileSize?: number;
  }>>([]);
  
  useEffect(() => {
    // Load history from localStorage
    try {
      const savedHistory = localStorage.getItem('analysisHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Could not load analysis history:", e);
    }
  }, []);
  
  if (history.length === 0) {
    return (
      <Center py="lg">
        <Text c="dimmed" size="sm">No analysis history yet. Analyze videos to see your history here.</Text>
      </Center>
    );
  }
  
  return (
    <Stack>
      {history.map((item, index) => {
        const date = new Date(item.date);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        // Extract video ID for thumbnail
        const videoId = item.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
        const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : undefined;
        
        return (
          <Paper key={index} p="sm" radius="sm" withBorder>
            <Group>
              {thumbnailUrl && (
                <Image src={thumbnailUrl} width={80} height={60} radius="sm" alt="Video thumbnail" />
              )}
              <div style={{ flex: 1 }}>
                <Group justify="apart">
                  <Text size="sm" fw={500}>
                    {item.title || (item.url.length > 50 ? item.url.substring(0, 50) + '...' : item.url)}
                  </Text>
                  <Text size="xs" c="dimmed">{formattedDate}</Text>
                </Group>
                <Group gap={8} mt={4}>
                  <Badge size="xs" color={item.type === 'video' ? 'violet' : 'pink'}>
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </Badge>
                  <Badge size="xs" variant="outline">
                    {item.durationSeconds}s
                  </Badge>
                  {item.fileSize && (
                    <Badge size="xs" variant="outline" color="gray">
                      ~{item.fileSize} MB
                    </Badge>
                  )}
                </Group>
              </div>
            </Group>
          </Paper>
        );
      })}
      
      <Button 
        onClick={() => {
          localStorage.removeItem('analysisHistory');
          setHistory([]);
        }}
        size="xs"
        variant="subtle"
        color="red"
        mt="sm"
      >
        Clear History
      </Button>
    </Stack>
  );
}
