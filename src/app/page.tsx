"use client"; // Required for useState and event handlers

import { useState, useEffect } from "react"; // Added useEffect
import ReactMarkdown from "react-markdown";

// Mantine components
import { 
  TextInput, Button, Card, Alert, Loader, Text, Title, Group, Stack, 
  Container, SimpleGrid, Paper, Center, AspectRatio, Image, Badge, Divider,
  ThemeIcon, Space
} from '@mantine/core';
import { notifications } from '@mantine/notifications'; // Corrected import path
import { IconAlertTriangle, IconPlayerPlay, IconMusic, IconFileCheck, IconSearch, IconDeviceFloppy, IconCheck, IconX } from '@tabler/icons-react';

// Import shared types
import { AnalysisType, ReportMetadata } from '@/types'; 

// Constants for warnings
const VIDEO_LENGTH_WARNING_MINUTES = 15; // Example: warn if video is longer than 15 minutes
const AUDIO_LENGTH_WARNING_MINUTES = 30; // Warn for audio longer than 30 minutes

// Re-define types locally for now
type TranscriptionQuality = 'low' | 'medium' | 'high';
type TranscriptionFormat = 'mp3' | 'wav' | 'm4a';
type AnalysisModel = 'gemini' | 'gpt4';

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisTypeForSave, setAnalysisTypeForSave] = useState<AnalysisType | null>(null); // Uses shared type
  
  // New state variables
  const [videoInfo, setVideoInfo] = useState<{ 
    id?: string;
    title?: string; 
    duration?: number;
    thumbnailUrl?: string;
  } | null>(null);
  const [showSizeWarning, setShowSizeWarning] = useState(false);

  // Fetch reports on component mount - REMOVED (will be on reports page)
  // useEffect(() => { fetchReports(); }, []);

  const handleYoutubeValidation = (isValid: boolean, info?: { id: string; title?: string; thumbnailUrl?: string }) => {
    if (isValid && info) {
      setVideoInfo(prev => ({ ...prev, id: info.id, title: info.title, thumbnailUrl: info.thumbnailUrl }));
      setShowSizeWarning(false);
      setError(null);
      // Simulate fetching duration (replace with actual API call if available)
      const mockDuration = Math.floor(Math.random() * 60) + 5;
      setVideoInfo(prev => ({ ...prev, duration: mockDuration }));
      if (mockDuration > VIDEO_LENGTH_WARNING_MINUTES) {
        setShowSizeWarning(true);
      }
    } else {
      setVideoInfo(null); // Clear info if invalid
      setShowSizeWarning(false);
      if (!isValid && youtubeUrl) setError("Invalid YouTube URL"); 
      else setError(null);
    }
  };

  const handleAnalyze = async (type: AnalysisType) => {
    if (!youtubeUrl) {
      setError("Please enter a YouTube URL.");
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
    
    setIsLoading(true);
    setError(null);
    setReportContent(null);
    setAnalysisTypeForSave(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl, analysisType: type }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      setReportContent(data.reportContent);
      setAnalysisTypeForSave(type);

    } catch (err) {
      console.error("Error calling analyze API:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
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
          youtube_url: youtubeUrl,
          analysis_type: analysisTypeForSave,
          report_content: reportContent,
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
      // REMOVED: await fetchReports(); 

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

  // URL validation effect with debounce
  useEffect(() => {
    // Only validate the URL, don't fetch reports here
    const timer = setTimeout(() => {
      if (youtubeUrl) {
        handleYoutubeValidation(true, { id: '', title: '', thumbnailUrl: '' });
      }
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timer);
  }, [youtubeUrl]);

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
          <TextInput
            label="YouTube Video URL"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(event) => setYoutubeUrl(event.currentTarget.value)}
            error={error === "Invalid YouTube URL" ? error : undefined}
            disabled={isLoading}
            size="sm"
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
          {isLoading && (
            <Center style={{ height: '200px' }}>
              <Loader color="violet" />
              <Text ml="sm" c="dimmed">Analyzing...</Text>
            </Center>
          )}
          
          {reportContent && !error && (
            <ReactMarkdown
              components={{
                h1: ({node, ...props}) => <Title order={3} my="sm" {...props} />,
                h2: ({node, ...props}) => <Title order={4} my="sm" {...props} />,
                h3: ({node, ...props}) => <Title order={5} my="xs" {...props} />,
                p: ({node, ...props}) => <Text size="sm" mb="xs" {...props} />,
                a: ({node, ...props}) => <Text component="a" c="pink.4" td="underline" {...props} />,
                li: ({node, ...props}) => <Text component="li" size="sm" {...props} />
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
    </Stack>
  );
}


