'use client';

import { useState, useEffect } from "react";
import { notifications } from '@mantine/notifications'; // Import notifications
import ReactMarkdown from "react-markdown"; // Keep for results display

// Mantine components
import { 
  Title, Text, Stack, Card, SimpleGrid, FileInput, Select, Button, 
  Textarea, Radio, Group, Divider, Alert, Loader, Center, Paper, ThemeIcon 
} from '@mantine/core';
import { IconUpload, IconFileText, IconAlertTriangle, IconCheck, IconX, IconAnalyze, IconDeviceFloppy } from '@tabler/icons-react';

// Re-create JobStatusDisplay logic within this component for now
import { Progress } from '@mantine/core'; // Using Mantine Progress

// Import shared types
import { 
  TranscriptionQuality, 
  TranscriptionFormat, 
  AnalysisModel,
  JobStatus
} from '@/types';

export default function TranscriptionPage() {
  // --- Transcription State --- 
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionQuality, setTranscriptionQuality] = useState<TranscriptionQuality>('medium');
  const [transcriptionFormat, setTranscriptionFormat] = useState<TranscriptionFormat>('mp3');
  const [transcriptionJobId, setTranscriptionJobId] = useState<string | null>(null);
  
  // --- Transcription Analysis State --- 
  const [transcriptionToAnalyze, setTranscriptionToAnalyze] = useState<string | null>(null);
  const [analysisModel, setAnalysisModel] = useState<AnalysisModel>('gemini');
  const [youtubeUrlForTranscript, setYoutubeUrlForTranscript] = useState<string | null>(null);
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);
  const [transcriptionResultContent, setTranscriptionResultContent] = useState<string | null>(null);
  const [transcriptionResultError, setTranscriptionResultError] = useState<string | null>(null);
  
  // --- Job Polling State --- 
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingInterval = 2000; // Poll every 2 seconds

  // --- Handlers --- 
  const handleTranscribe = async () => {
    if (!selectedFile) {
      notifications.show({ title: 'Error', message: 'Please select an audio or video file to transcribe.', color: 'red', icon: <IconX /> });
      return;
    }
    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscriptionResult(null); 
    setTranscriptionResultContent(null); 
    setTranscriptionJobId(null);
    setJobStatus(null); // Reset job status display
    setIsPolling(false); // Stop any previous polling

    try {
      const formData = new FormData();
      formData.append('audioFile', selectedFile);
      formData.append('quality', transcriptionQuality);
      formData.append('format', transcriptionFormat);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `API request failed`);

      if (data.job_id) {
        setTranscriptionJobId(data.job_id);
        setIsPolling(true); // Start polling for the new job
      } else if (data.text) {
         setTranscriptionResult(data.text);
         setIsTranscribing(false);
         notifications.show({ title: 'Success', message: 'Transcription completed immediately.', color: 'green', icon: <IconCheck /> });
      } else {
         throw new Error("No job ID or transcription text received.");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown transcription error.";
      setTranscriptionError(errorMsg);
      notifications.show({ title: 'Transcription Failed', message: errorMsg, color: 'red', icon: <IconX /> });
      setIsTranscribing(false);
    }
  };

  const handleTranscriptionComplete = (result: any) => {
    setIsTranscribing(false); 
    setTranscriptionJobId(null); 
    setJobStatus(null);
    setIsPolling(false);
    if (result && result.content) {
      setTranscriptionResult(result.content); 
      notifications.show({ title: 'Success', message: 'Transcription completed.', color: 'green', icon: <IconCheck /> });
    } else {
        const errorMsg = "Transcription job finished but no content was found.";
        setTranscriptionError(errorMsg);
        notifications.show({ title: 'Completion Error', message: errorMsg, color: 'orange', icon: <IconAlertTriangle /> });
    }
  };

  const handleTranscriptionError = (error: string) => {
    setIsTranscribing(false); 
    setTranscriptionJobId(null); 
    setJobStatus(null);
    setIsPolling(false);
    const errorMsg = error || "Transcription job failed.";
    setTranscriptionError(errorMsg);
    notifications.show({ title: 'Job Failed', message: errorMsg, color: 'red', icon: <IconX /> });
  };

  // --- Job Status Polling Effect --- 
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const fetchJobStatus = async () => {
      if (!transcriptionJobId || !isPolling) return;

      try {
        const response = await fetch(`/api/job-status?id=${transcriptionJobId}`);
        if (!response.ok) {
          // Don't stop polling on temporary network issues, but maybe show a transient warning
          console.warn(`Failed to fetch job status (${response.status}), retrying...`);
          return; 
        }
        const data: JobStatus = await response.json();
        setJobStatus(data);

        if (data.status === 'completed') {
          setIsPolling(false); // Stop polling
          handleTranscriptionComplete(data.result); // Pass result data
          if (intervalId) clearInterval(intervalId);
        } else if (data.status === 'failed') {
          setIsPolling(false); // Stop polling
          handleTranscriptionError(data.error || 'Job failed without specific error message');
          if (intervalId) clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        // Keep polling on fetch errors
      }
    };

    if (isPolling && transcriptionJobId) {
      fetchJobStatus(); // Initial fetch
      intervalId = setInterval(fetchJobStatus, pollingInterval);
    }

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [transcriptionJobId, isPolling]); // Dependencies

  // --- Transcription Analysis Handlers --- 
  const handleAnalyzeTranscription = async () => {
    if (!transcriptionToAnalyze || transcriptionToAnalyze.length < 50) {
      notifications.show({ title: 'Input Required', message: 'Please enter at least 50 characters for analysis.', color: 'orange', icon: <IconAlertTriangle /> });
      return;
    }
    setIsAnalyzingTranscript(true);
    setTranscriptionResultError(null);
    setTranscriptionResultContent(null);
    try {
      const response = await fetch('/api/analyze-transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl: youtubeUrlForTranscript,
          modelType: analysisModel,
          transcriptionText: transcriptionToAnalyze,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Analysis API failed`);
      setTranscriptionResultContent(data.reportContent);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown analysis error.";
      setTranscriptionResultError(errorMsg);
      notifications.show({ title: 'Analysis Failed', message: errorMsg, color: 'red', icon: <IconX /> });
    } finally {
      setIsAnalyzingTranscript(false);
    }
  };

  // --- Render Logic --- 
  return (
    <Stack gap="xl">
      {/* Section 1: Transcribe File */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={3} mb="md">Transcribe Audio/Video File</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
          <FileInput
            label="Select File"
            placeholder="Click or drag to upload (Max 25MB)"
            value={selectedFile}
            onChange={setSelectedFile}
            accept="audio/*,video/*" // Standard HTML accept attribute
            leftSection={<IconUpload size={16} />}
            clearable
            disabled={isTranscribing || isPolling}
          />
           {/* TODO: Add more robust validation if needed */}
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="lg">
           <Select
             label="Audio Quality (Output)"
             value={transcriptionQuality}
             onChange={(value) => setTranscriptionQuality(value as TranscriptionQuality)}
             data={[
               { value: 'low', label: 'Low (Smaller File)' },
               { value: 'medium', label: 'Medium (Balanced)' },
               { value: 'high', label: 'High (Best Quality)' },
             ]}
             disabled={isTranscribing || isPolling}
           />
           <Select
             label="Audio Format (Output)"
             value={transcriptionFormat}
             onChange={(value) => setTranscriptionFormat(value as TranscriptionFormat)}
             data={[
               { value: 'mp3', label: 'MP3' },
               { value: 'wav', label: 'WAV' },
               { value: 'm4a', label: 'M4A' },
             ]}
             disabled={isTranscribing || isPolling}
           />
        </SimpleGrid>
        
        <Group justify="center" mb="md">
            <Button 
              onClick={handleTranscribe}
              disabled={!selectedFile || isTranscribing || isPolling}
              loading={isTranscribing || isPolling}
              leftSection={<IconFileText size={16} />}
            >
              {isPolling ? 'Processing...' : isTranscribing ? 'Starting...' : 'Transcribe File'}
            </Button>
        </Group>

        {/* Job Status Display Area */}
        {transcriptionJobId && (
          <Paper p="md" radius="sm" withBorder bg="dark.8">
            <Stack gap="xs">
              <Group justify="space-between">
                  <Text size="sm" fw={500}>
                      {jobStatus?.status === 'completed' ? 'Job Complete' : 
                       jobStatus?.status === 'failed' ? 'Job Failed' :
                       jobStatus?.message || 'Processing...'}
                  </Text>
                  {/* Optional: Status Badge */} 
              </Group>
               <Progress 
                 value={jobStatus?.progress || (jobStatus?.status === 'processing' ? 10 : 0)} 
                 animated={jobStatus?.status === 'processing'} 
                 striped={jobStatus?.status === 'processing'} 
                 color={jobStatus?.status === 'failed' ? 'red' : jobStatus?.status === 'completed' ? 'green' : 'blue'}
                 size="sm"
               />
               {jobStatus?.error && (
                   <Alert variant="light" color="red" title="Job Error" icon={<IconAlertTriangle size={16}/>} radius="sm">
                     {jobStatus.error}
                   </Alert>
               )}
            </Stack>
          </Paper>
        )}
        
        {/* Direct Transcription Error (before job starts) */} 
        {transcriptionError && !transcriptionJobId && (
           <Alert variant="light" color="red" title="Error" icon={<IconAlertTriangle size={16}/>} radius="sm" mt="md">
             {transcriptionError}
           </Alert>
         )}

        {/* Transcription Result Display */}
        {transcriptionResult && (
            <Paper withBorder p="md" mt="md" radius="sm">
                <Title order={5} mb="xs">Transcription Result:</Title>
                <Textarea
                    value={transcriptionResult}
                    readOnly
                    autosize
                    minRows={5}
                    maxRows={15}
                />
                 <Group justify="flex-end" mt="sm">
                     <Button 
                       variant="light"
                       size="xs"
                       onClick={() => {
                           setTranscriptionToAnalyze(transcriptionResult);
                           // Optionally scroll to analysis section
                           document.getElementById('analyze-section')?.scrollIntoView({ behavior: 'smooth' });
                       }}
                     >
                         Use for Analysis
                     </Button>
                 </Group>
            </Paper>
        )}
      </Card>

      <Divider my="xl" id="analyze-section" />

      {/* Section 2: Analyze Transcription */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
         <Title order={3} mb="md">Analyze Transcription Text</Title>
          <Stack gap="md">
              <Textarea
                label="Transcription Text"
                placeholder="Paste transcription here, or use the result from above..."
                value={transcriptionToAnalyze || ''}
                onChange={(event) => setTranscriptionToAnalyze(event.currentTarget.value)}
                autosize
                minRows={6}
                disabled={isAnalyzingTranscript}
              />
              {/* Optional: YouTube URL for context */}
              {/* <TextInput label="YouTube URL (Optional Context)" ... /> */}
              
              <Radio.Group
                  name="analysisModel"
                  label="Select Analysis Model"
                  value={analysisModel}
                  onChange={(value) => setAnalysisModel(value as AnalysisModel)}
                  withAsterisk={false} // Assuming optional choice
              >
                  <Group mt="xs">
                      <Radio value="gemini" label="Gemini (Default)" disabled={isAnalyzingTranscript}/>
                      <Radio value="gpt4" label="GPT-4" disabled={isAnalyzingTranscript}/>
                  </Group>
              </Radio.Group>
              
               <Group justify="center" mt="md">
                   <Button 
                     leftSection={<IconAnalyze size={16} />}
                     onClick={handleAnalyzeTranscription}
                     loading={isAnalyzingTranscript}
                     disabled={!transcriptionToAnalyze || (transcriptionToAnalyze?.length || 0) < 50}
                   >
                       Analyze Transcription
                   </Button>
               </Group>

              {transcriptionResultError && (
                 <Alert variant="light" color="red" title="Analysis Error" icon={<IconAlertTriangle size={16}/>} radius="sm">
                   {transcriptionResultError}
                 </Alert>
               )}

              {transcriptionResultContent && (
                  <Paper withBorder p="md" mt="md" radius="sm">
                      <Title order={5} mb="xs">Analysis Results:</Title>
                      <ReactMarkdown>
                          {transcriptionResultContent}
                      </ReactMarkdown>
                       {/* Optional: Save Button? */}
                  </Paper>
              )}
          </Stack>
      </Card>
    </Stack>
  );
} 