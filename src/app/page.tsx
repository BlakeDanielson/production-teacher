"use client"; // Required for useState and event handlers

import { useState, useEffect } from "react"; // Added useEffect
import ReactMarkdown from "react-markdown";

// Mantine components
import { 
  TextInput, Button, Card, Alert, Loader, Text, Title, Group, Stack, 
  Container, SimpleGrid, Paper, Center, AspectRatio, Image, Badge, Divider,
  ThemeIcon // Added ThemeIcon
} from '@mantine/core';
import { IconAlertTriangle, IconPlayerPlay, IconMusic, IconFileCheck, IconSearch, IconDeviceFloppy } from '@tabler/icons-react';

// Constants for warnings
const VIDEO_LENGTH_WARNING_MINUTES = 15; // Example: warn if video is longer than 15 minutes
const AUDIO_LENGTH_WARNING_MINUTES = 30; // Warn for audio longer than 30 minutes

// Interface for Report Metadata (matching backend GET response)
interface ReportMetadata {
  id: string;
  youtube_url: string;
  analysis_type: 'video' | 'audio';
  created_at: string;
}

// Re-define types locally for now
type AnalysisType = 'video' | 'audio';
type TranscriptionQuality = 'low' | 'medium' | 'high';
type TranscriptionFormat = 'mp3' | 'wav' | 'm4a';
type AnalysisModel = 'gemini' | 'gpt4';

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisTypeForSave, setAnalysisTypeForSave] = useState<AnalysisType | null>(null); // Track type for saving
  const [savedReports, setSavedReports] = useState<ReportMetadata[]>([]); // State for saved reports list
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set()); // State for selected reports
  const [isSynthesizing, setIsSynthesizing] = useState(false); // Loading state for synthesis
  const [synthesisResult, setSynthesisResult] = useState<string | null>(null); // State for synthesis result
  const [synthesisError, setSynthesisError] = useState<string | null>(null); // Error state for synthesis
  
  // New state variables
  const [videoInfo, setVideoInfo] = useState<{ 
    id?: string;
    title?: string; 
    duration?: number;
    thumbnailUrl?: string;
  } | null>(null);
  const [showSizeWarning, setShowSizeWarning] = useState(false);

  // Fetch reports on component mount
  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    // Clear previous report-fetching errors
    // setError(prev => prev === "Could not load saved reports." ? null : prev);
    try {
      const response = await fetch('/api/reports');
      if (!response.ok) {
        throw new Error(`Failed to fetch reports: ${response.statusText}`);
      }
      const data: ReportMetadata[] = await response.json();
      setSavedReports(data);
    } catch (err) {
      console.error("Error fetching reports:", err);
      // Optionally set an error state for report fetching
      setError(prev => prev ? `${prev}\nCould not load saved reports.` : "Could not load saved reports.");
    }
  };

  const handleSynthesize = async () => {
    if (selectedReportIds.size < 2) {
      setSynthesisError("Please select at least two reports to synthesize.");
      return;
    }
    setIsSynthesizing(true);
    setSynthesisError(null);
    setSynthesisResult(null);

    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds: Array.from(selectedReportIds) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      setSynthesisResult(data.synthesisResult);

    } catch (err) {
      console.error("Error calling synthesize API:", err);
      setSynthesisError(err instanceof Error ? err.message : "An unknown error occurred during synthesis.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleCheckboxChange = (reportId: string, isChecked: boolean) => {
    setSelectedReportIds(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(reportId);
      } else {
        newSet.delete(reportId);
      }
      return newSet;
    });
  };

  // Handle YouTube URL validation callback
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

  // Modify the existing handleAnalyze function to check for warnings
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
      // Use Mantine notifications instead of alert
      console.error("Cannot save report: Missing data");
      return;
    }
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
      // Report saved, maybe clear current report or give feedback
      console.log("Report saved successfully!");
      setReportContent(null); // Optionally clear the current report view
      setAnalysisTypeForSave(null);
      await fetchReports(); // Refresh the list of saved reports
    } catch (err) {
      console.error("Error saving report:", err);
      setError(err instanceof Error ? err.message : "Could not save the report.");
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm(`Are you sure you want to delete report ${id}?`)) {
      return;
    }
    try {
      const response = await fetch(`/api/reports?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete report');
      }
      console.log(`Report ${id} deleted.`);
      await fetchReports(); // Refresh the list
    } catch (err) {
      console.error(`Error deleting report ${id}:`, err);
      setError(err instanceof Error ? err.message : "Could not delete the report.");
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
        <Text c="dimmed">
          Analyze YouTube videos for content insights and production quality feedback.
        </Text>
      </div>
      <Divider />

      {/* Input Card */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <TextInput
            label="YouTube Video URL"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(event) => setYoutubeUrl(event.currentTarget.value)}
            error={error === "Invalid YouTube URL" ? error : undefined}
            disabled={isLoading}
            size="md"
          />
          
          {videoInfo && videoInfo.thumbnailUrl && (
            <Paper p="xs" radius="sm" withBorder>
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
            >
              Video length might exceed limits for full analysis. Consider Audio Only.
            </Alert>
          )}
          
          {error && error !== "Invalid YouTube URL" && (
            <Alert variant="light" color="red" title="Error" icon={<IconAlertTriangle size={16}/>} radius="sm">
              {error}
            </Alert>
          )}
        </Stack>

        <Group justify="center" mt="xl"> 
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
            variant="outline"
            color="pink"
            size="sm"
          >
            Analyze Audio Only
          </Button>
        </Group>
      </Card>

      {/* Results Card */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={4}>Analysis Report</Title>
          {reportContent && !isLoading && (
            <Button
              leftSection={<IconDeviceFloppy size={16}/>}
              onClick={handleSaveReport}
              size="xs"
              variant="light"
              color="green"
            >
              Save Report
            </Button>
          )}
        </Group>
        
        <Paper p="md" radius="sm" bg="dark.8" miw={200} mih={200}>
          {isLoading && (
            <Center style={{ height: '200px' }}>
              <Loader />
              <Text ml="sm" c="dimmed">Analyzing...</Text>
            </Center>
          )}
          
          {reportContent && !error && (
            <ReactMarkdown 
            >
              {reportContent}
            </ReactMarkdown>
          )}
          
          {!isLoading && !error && !reportContent && (
            <Center style={{ height: '200px', flexDirection: 'column' }}>
              <ThemeIcon variant="light" size="xl" mb="md" color="gray">
                <IconSearch size={24} />
              </ThemeIcon>
              <Text c="dimmed">Enter a URL and click Analyze to see the report here.</Text>
            </Center>
          )}
        </Paper>
      </Card>
    </Stack>
  );
}


