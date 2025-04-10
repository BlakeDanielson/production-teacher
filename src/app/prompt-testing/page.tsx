'use client';

import { useState, useEffect } from 'react';
import {
  Title, Text, Stack, Button, Group, Tabs, Card, Checkbox,
  TextInput, Textarea, Select, Alert, Badge, Code,
  Accordion, Paper, Divider, Tooltip, ScrollArea, Progress // Removed unused ActionIcon
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlaylistX, IconBrandYoutube, IconInfoCircle, IconFlask, IconTrash, IconPlus, IconCheck, IconRocket, IconNote, IconPlayerStop } from '@tabler/icons-react'; // Removed unused IconX, IconBrandOpenai, IconCode
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '@/store/store';
import { AnalysisType } from '@/types';
import {
  getAvailablePrompts,
  // Removed unused runPromptTest
  runPromptBatchTest,
  addCustomPrompt,
  saveTestResults,
  loadTestResults,
  clearTestResults
} from '@/lib/promptTesting';
import { YoutubeInput } from '../components/YoutubeInput';
import { generateAnalysisId, initializeProgressTracking, cancelAnalysis, useProgressTracker } from '@/lib/progressTracker';

// Import TestResult type from promptTesting
import type { TestResult } from '@/lib/promptTesting';

export default function PromptTestingPage() {
  // App state
  const { googleApiKey } = useAppStore();
  
  // Form state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<{id?: string; title?: string; duration?: number} | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>('video');
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  
  // Testing state
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [savedResults, setSavedResults] = useState<TestResult[]>([]);
  
  // Progress tracking
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const analysisStatus = useProgressTracker(currentJobId);
  
  // Custom prompt state
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [customPromptName, setCustomPromptName] = useState('');
  const [customPromptText, setCustomPromptText] = useState('');
  
  // Get available prompts
  const availablePrompts = getAvailablePrompts();
  
  // Load saved test results on mount
  useEffect(() => {
    const results = loadTestResults();
    setSavedResults(results);
  }, []);

  // Removed original handleYoutubeValidation function definition (duplicated below)

  // Handle prompt selection toggle
  const handlePromptToggle = (promptId: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedPromptIds(prev => [...prev, promptId]);
    } else {
      setSelectedPromptIds(prev => prev.filter(id => id !== promptId));
    }
  };
  
  // Handle adding a custom prompt
  const handleAddCustomPrompt = () => {
    if (!customPromptName || !customPromptText) {
      notifications.show({
        title: 'Missing Information',
        message: 'Please provide both a name and prompt text',
        color: 'red'
      });
      return;
    }
    
    const newPrompt = addCustomPrompt({
      name: customPromptName,
      prompt: customPromptText,
      description: 'Custom prompt'
    });
    
    // Select the new prompt
    handlePromptToggle(newPrompt.id, true);
    
    // Reset form
    setCustomPromptName('');
    setCustomPromptText('');
    setShowCustomPrompt(false);
    
    notifications.show({
      title: 'Prompt Added',
      message: 'Custom prompt has been added and selected',
      color: 'green'
    });
  };
  
  // Handle cancellation of an in-progress test
  const handleCancelTest = () => {
    if (currentJobId) {
      // Cancel in the progress tracker
      cancelAnalysis(currentJobId);
      
      // Also abort the fetch if it's in progress
      if (abortController) {
        abortController.abort();
      }
      
      notifications.show({
        title: 'Test Cancelled',
        message: 'The prompt test was cancelled by user',
        color: 'red'
      });
      
      // Reset after a short delay
      setTimeout(() => {
        setIsRunningTest(false);
        setCurrentJobId(null);
      }, 2000);
    }
  };

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
  
  // Run a batch test with selected prompts
  const handleRunTest = async () => {
    if (!youtubeUrl) {
      notifications.show({
        title: 'Missing URL',
        message: 'Please enter a YouTube URL',
        color: 'red'
      });
      return;
    }
    
    if (selectedPromptIds.length === 0) {
      notifications.show({
        title: 'No Prompts Selected',
        message: 'Please select at least one prompt to test',
        color: 'red'
      });
      return;
    }
    
    if (!googleApiKey) {
      notifications.show({
        title: 'Missing API Key',
        message: 'Please set your Google API key in Settings',
        color: 'red'
      });
      return;
    }
    
    // Create an AbortController for this request
    const controller = new AbortController();
    setAbortController(controller);
    
    // Create job ID and start progress tracking
    const jobId = generateAnalysisId();
    setCurrentJobId(jobId);
    initializeProgressTracking(jobId, analysisType, videoInfo?.duration);
    
    setIsRunningTest(true);
    setTestResults([]);
    
    try {
      const testConfig = {
        videoUrl: youtubeUrl,
        analysisType,
        googleApiKey,
        jobId // Pass the job ID to track progress
      };
      
      const results = await runPromptBatchTest(selectedPromptIds, testConfig);
      setTestResults(results);
      
      // Save results
      saveTestResults(results);
      setSavedResults(prevResults => [...results, ...prevResults]);
      
      notifications.show({
        title: 'Test Complete',
        message: `Completed ${results.length} prompt tests`,
        color: 'green'
      });
    } catch (error) {
      console.error('Error running test:', error);
      
      // Check if this was an abort error
      if (error instanceof DOMException && error.name === 'AbortError') {
        notifications.show({
          title: 'Test Cancelled',
          message: 'The prompt test was cancelled by user',
          color: 'orange'
        });
      } else {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        
        notifications.show({
          title: 'Test Failed',
          message,
          color: 'red'
        });
      }
    } finally {
      setIsRunningTest(false);
    }
  };
  
  // Clear test results
  const handleClearResults = () => {
    clearTestResults();
    setSavedResults([]);
    
    notifications.show({
      title: 'Results Cleared',
      message: 'All saved test results have been cleared',
      color: 'blue'
    });
  };
  
  // Group results by video URL for display
  const groupedResults = savedResults.reduce((groups, result) => {
    const key = result.videoUrl;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(result);
    return groups;
  }, {} as Record<string, TestResult[]>);

  // Define type for YouTube info used in validation callback
  type ValidationInfo = {
    id: string;
    title?: string;
    thumbnailUrl?: string; // Added thumbnailUrl based on YoutubeInput component
    duration?: number;
  };

  // Handle YouTube URL validation
  const handleYoutubeValidation = (isValid: boolean, info?: ValidationInfo) => { // Changed any to ValidationInfo
    if (isValid && info) {
      setVideoInfo(info);
    } else {
      setVideoInfo(null);
    }
  };

  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>Prompt Testing Lab</Title>
        <Text c="dimmed" size="sm">
          Test different analysis prompts against videos to see which provides the best results
        </Text>
      </div>
      
      <Tabs defaultValue="run-test">
        <Tabs.List>
          <Tabs.Tab value="run-test" leftSection={<IconFlask size={16} />}>
            Run Tests
          </Tabs.Tab>
          <Tabs.Tab value="results" leftSection={<IconNote size={16} />}>
            Results
          </Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Panel value="run-test" pt="md">
          <Stack gap="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack gap="md">
                <Title order={4}>Configure Test</Title>
                
                <YoutubeInput
                  value={youtubeUrl}
                  onChange={setYoutubeUrl}
                  onValidation={handleYoutubeValidation}
                  isDisabled={isRunningTest}
                />
                
                {videoInfo && videoInfo.title && (
                  <Alert color="blue" variant="light" title={videoInfo.title}>
                    {videoInfo.duration && <Text size="sm">Duration: ~{videoInfo.duration} min</Text>}
                    {videoInfo.id && <Badge mt={5}>ID: {videoInfo.id}</Badge>}
                  </Alert>
                )}
                
                <Select
                  label="Analysis Type"
                  data={[
                    { value: 'video', label: 'Full Video Analysis' },
                    { value: 'audio', label: 'Audio Only Analysis' }
                  ]}
                  value={analysisType}
                  onChange={(value) => setAnalysisType(value as AnalysisType)}
                  disabled={isRunningTest}
                />
              </Stack>
            </Card>
            
            {/* Show progress card when test is running */}
            {isRunningTest && analysisStatus && (
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Title order={4}>Test Progress</Title>
                    
                    {analysisStatus.stage !== 'complete' && analysisStatus.stage !== 'error' && (
                      <Button 
                        variant="subtle" 
                        color="red" 
                        size="xs"
                        leftSection={<IconPlayerStop size={16} />}
                        onClick={handleCancelTest}
                      >
                        Cancel
                      </Button>
                    )}
                  </Group>
                  
                  <Paper p="md" withBorder>
                    <Group justify="apart" mb="xs">
                      <Group>
                        <Badge color={
                          analysisStatus.stage === 'error' ? 'red' : 
                          analysisStatus.stage === 'complete' ? 'green' : 
                          analysisStatus.stage === 'analyzing' ? 'violet' :
                          analysisStatus.stage === 'analyzing_pending' ? 'yellow' : 
                          analysisStatus.stage === 'downloading' ? 'blue' : 
                          'teal'
                        }>
                          {analysisStatus.stage.charAt(0).toUpperCase() + analysisStatus.stage.slice(1)}
                          {analysisStatus.stage === 'analyzing_pending' && '...'}
                        </Badge>
                        <Text size="sm">{analysisStatus.progress}%</Text>
                      </Group>
                      
                      {analysisStatus.estimatedTimeRemaining && analysisStatus.stage !== 'complete' && analysisStatus.stage !== 'error' && (
                        <Text size="xs" c="dimmed">
                          {formatTimeRemaining(analysisStatus.estimatedTimeRemaining)}
                        </Text>
                      )}
                    </Group>
                    
                    <Progress 
                      value={analysisStatus.progress} 
                      size="sm" 
                      radius="xl"
                      color={
                        analysisStatus.stage === 'error' ? 'red' : 
                        analysisStatus.stage === 'complete' ? 'green' : 
                        analysisStatus.stage === 'analyzing' ? 'violet' :
                        analysisStatus.stage === 'analyzing_pending' ? 'yellow' : 
                        analysisStatus.stage === 'downloading' ? 'blue' : 
                        'teal'
                      }
                      striped={analysisStatus.stage !== 'complete' && analysisStatus.stage !== 'error'}
                      animated={analysisStatus.stage !== 'complete' && analysisStatus.stage !== 'error'}
                    />
                    
                    <Text size="xs" c="dimmed" mt={5}>
                      {analysisStatus.details || 'Processing...'}
                      {analysisStatus.fileSize && ` (${Math.round(analysisStatus.fileSize / 1024 / 1024 * 10) / 10} MB)`}
                    </Text>
                  </Paper>
                  
                  <Text size="sm" c="dimmed" ta="center">
                    Testing {selectedPromptIds.length} prompt{selectedPromptIds.length !== 1 ? 's' : ''} against the video...
                  </Text>
                </Stack>
              </Card>
            )}
            
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={4}>Select Prompts to Test</Title>
                  <Group gap="xs">
                    <Button 
                      leftSection={<IconCheck size={16} />}
                      size="xs"
                      variant="light"
                      onClick={() => {
                        const allPromptIds = availablePrompts.map(prompt => prompt.id);
                        const allSelected = allPromptIds.length === selectedPromptIds.length;
                        setSelectedPromptIds(allSelected ? [] : allPromptIds);
                      }}
                      disabled={isRunningTest}
                    >
                      {availablePrompts.length === selectedPromptIds.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Button 
                      leftSection={<IconPlus size={16} />}
                      size="xs"
                      variant="light"
                      onClick={() => setShowCustomPrompt(true)}
                      disabled={isRunningTest}
                    >
                      Add Custom Prompt
                    </Button>
                  </Group>
                </Group>
                
                {showCustomPrompt && (
                  <Paper p="md" withBorder>
                    <Stack gap="md">
                      <TextInput
                        label="Prompt Name"
                        placeholder="e.g., Detailed Technical Feedback"
                        value={customPromptName}
                        onChange={(e) => setCustomPromptName(e.currentTarget.value)}
                      />
                      
                      <Textarea
                        label="Prompt Text"
                        placeholder="Enter your custom prompt here..."
                        minRows={5}
                        value={customPromptText}
                        onChange={(e) => setCustomPromptText(e.currentTarget.value)}
                      />
                      
                      <Group justify="flex-end">
                        <Button 
                          variant="subtle" 
                          onClick={() => setShowCustomPrompt(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleAddCustomPrompt}
                        >
                          Add Prompt
                        </Button>
                      </Group>
                    </Stack>
                  </Paper>
                )}
                
                <Stack gap="xs">
                  {availablePrompts.map(prompt => (
                    <Paper p="md" withBorder key={prompt.id}>
                      <Group mb="sm">
                        <Checkbox
                          checked={selectedPromptIds.includes(prompt.id)}
                          onChange={(e) => handlePromptToggle(prompt.id, e.currentTarget.checked)}
                          label={prompt.name}
                          disabled={isRunningTest}
                        />
                        
                        {prompt.description && (
                          <Tooltip label={prompt.description}>
                            <IconInfoCircle size={16} style={{ opacity: 0.6 }} />
                          </Tooltip>
                        )}
                      </Group>
                      
                      <Accordion variant="contained">
                        <Accordion.Item value="prompt">
                          <Accordion.Control>View Prompt</Accordion.Control>
                          <Accordion.Panel>
                            <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '100%' }}>
                              {prompt.prompt}
                            </Code>
                          </Accordion.Panel>
                        </Accordion.Item>
                      </Accordion>
                    </Paper>
                  ))}
                </Stack>
                
                <Button
                  mt="md"
                  leftSection={<IconRocket size={16} />}
                  onClick={handleRunTest}
                  loading={isRunningTest}
                  disabled={!youtubeUrl || selectedPromptIds.length === 0 || isRunningTest}
                >
                  {isRunningTest 
                    ? `Testing ${selectedPromptIds.length} prompts...` 
                    : `Run Test${selectedPromptIds.length > 1 ? 's' : ''}`}
                </Button>
              </Stack>
            </Card>
            
            {testResults.length > 0 && (
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Title order={4}>Test Results</Title>
                  
                  {testResults.map((result, index) => (
                    <Paper p="md" withBorder key={index}>
                      <Group mb="sm" justify="space-between">
                        <Badge size="lg" variant="filled" color="blue">{result.promptName}</Badge>
                        <Text size="xs" c="dimmed">
                          {new Date(result.timestamp).toLocaleString()}
                        </Text>
                      </Group>
                      
                      <Divider my="sm" />
                      
                      <ScrollArea h={300} scrollbarSize={8}>
                        <ReactMarkdown>
                          {result.response}
                        </ReactMarkdown>
                      </ScrollArea>
                    </Paper>
                  ))}
                </Stack>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>
        
        <Tabs.Panel value="results" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Saved Test Results</Title>
              
              <Button
                leftSection={<IconTrash size={16} />}
                variant="light"
                color="red"
                onClick={handleClearResults}
                disabled={savedResults.length === 0}
              >
                Clear All Results
              </Button>
            </Group>
            
            {savedResults.length === 0 ? (
              <Alert icon={<IconPlaylistX />} title="No Results">
                No test results found. Run some tests to compare prompt performance.
              </Alert>
            ) : (
              <Accordion>
                {Object.entries(groupedResults).map(([videoUrl, results]) => (
                  <Accordion.Item value={videoUrl} key={videoUrl}>
                    <Accordion.Control>
                      <Group>
                        <IconBrandYoutube size={18} />
                        <Text fw={500}>
                          {results[0].videoTitle || videoUrl}
                        </Text>
                        <Badge size="sm">
                          {results.length} test{results.length !== 1 ? 's' : ''}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        {results.map((result, index) => (
                          <Paper p="md" withBorder key={index}>
                            <Group mb="sm" justify="space-between">
                              <Badge size="lg" variant="filled" color="blue">{result.promptName}</Badge>
                              <Group gap="sm">
                                <Badge variant="outline" color={result.analysisType === 'video' ? 'violet' : 'pink'}>
                                  {result.analysisType}
                                </Badge>
                                <Text size="xs" c="dimmed">
                                  {new Date(result.timestamp).toLocaleString()}
                                </Text>
                              </Group>
                            </Group>
                            
                            <Divider my="sm" />
                            
                            <ScrollArea h={300} scrollbarSize={8}>
                              <ReactMarkdown>
                                {result.response}
                              </ReactMarkdown>
                            </ScrollArea>
                          </Paper>
                        ))}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
