"use client"; // Required for useState and event handlers

import { useState, useEffect } from "react"; // Added useEffect
import ReactMarkdown from "react-markdown";
import FileUpload from "@/components/FileUpload";
import JobStatusDisplay from "@/components/JobStatusDisplay";
import YoutubeInput from "@/components/YoutubeInput";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Icons
import { Play, Music, FileCheck, Loader2, Check, AlertTriangle, TextSearch, Youtube, BarChart } from "lucide-react";

type AnalysisType = 'video' | 'audio';
type TranscriptionQuality = 'low' | 'medium' | 'high';
type TranscriptionFormat = 'mp3' | 'wav' | 'm4a';
type AnalysisModel = 'gemini' | 'gpt4';

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

  // New state variables for transcription feature
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionQuality, setTranscriptionQuality] = useState<TranscriptionQuality>('medium');
  const [transcriptionFormat, setTranscriptionFormat] = useState<TranscriptionFormat>('mp3');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // New state variables for transcription-based analysis
  const [transcriptionToAnalyze, setTranscriptionToAnalyze] = useState<string | null>(null);
  const [transcriptionResultError, setTranscriptionResultError] = useState<string | null>(null);
  const [transcriptionResultContent, setTranscriptionResultContent] = useState<string | null>(null);
  const [analysisModel, setAnalysisModel] = useState<AnalysisModel>('gemini');
  const [youtubeUrlForTranscript, setYoutubeUrlForTranscript] = useState<string | null>(null);
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);

  // New state variables for job handling
  const [transcriptionJobId, setTranscriptionJobId] = useState<string | null>(null);

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
      setShowSizeWarning(false);
      // Only show error if URL is invalid AND the input field is not empty
      if (!isValid && youtubeUrl) setError("Invalid YouTube URL"); 
      else setError(null); // Clear error if input is empty
    }
  };

  // Modify the existing handleAnalyze function to check for warnings
  const handleAnalyze = async (analysisType: AnalysisType) => {
    if (!youtubeUrl) {
      setError("Please enter a YouTube URL.");
      return;
    }
    
    // If analyzing a video that's too long, show confirmation
    if (analysisType === 'video' && videoInfo?.duration && videoInfo.duration > VIDEO_LENGTH_WARNING_MINUTES) {
      if (!confirm(`This video appears to be ${videoInfo.duration} minutes long, which might exceed Gemini's file size limits. Full video analysis might fail. Continue anyway?\n\nTip: Try audio-only analysis for long videos.`)) {
        return;
      }
    }
    // If analyzing audio that's very long, show a milder warning
    else if (analysisType === 'audio' && videoInfo?.duration && videoInfo.duration > AUDIO_LENGTH_WARNING_MINUTES) {
      if (!confirm(`This audio is ${videoInfo.duration} minutes long, which might take longer to process. Continue?`)) {
        return;
      }
    }
    
    setIsLoading(true);
    setError(null);
    setReportContent(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ youtubeUrl, analysisType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      setReportContent(data.reportContent);
      setAnalysisTypeForSave(analysisType);

    } catch (err) {
      console.error("Error calling analyze API:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!reportContent || !analysisTypeForSave || !youtubeUrl) {
      setError("Cannot save report: Missing content, analysis type, or original URL.");
      return;
    }
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtube_url: youtubeUrl, // Changed to match Supabase column
          analysis_type: analysisTypeForSave, // Changed to match Supabase column
          report_content: reportContent, // Changed to match Supabase column
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

  // Handle transcription request - updated to use job system
  const handleTranscribe = async () => {
    if (!selectedFile) {
      setTranscriptionError("Please select an audio or video file to transcribe.");
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscriptionResult(null);
    setTranscriptionJobId(null);

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

      if (!response.ok) {
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      // Set the job ID for tracking
      if (data.job_id) {
        setTranscriptionJobId(data.job_id);
      }

      // If we already have results, use them
      if (data.text) {
        setTranscriptionResult(data.text);
      }

    } catch (err) {
      console.error("Error calling transcribe API:", err);
      setTranscriptionError(err instanceof Error ? err.message : "An unknown error occurred during transcription.");
      setIsTranscribing(false);
    }
  };

  // Handle job completion
  const handleTranscriptionComplete = (result: any) => {
    setIsTranscribing(false);
    if (result && result.content) {
      setTranscriptionResult(result.content);
    }
  };

  // Handle job error
  const handleTranscriptionError = (error: string) => {
    setIsTranscribing(false);
    setTranscriptionError(error);
  };

  const handleAnalyzeTranscription = async () => {
    if (!transcriptionToAnalyze || transcriptionToAnalyze.length < 50) {
      setTranscriptionResultError("Please enter at least 50 characters for analysis.");
      return;
    }

    setIsAnalyzingTranscript(true);
    setTranscriptionResultError(null);
    setTranscriptionResultContent(null);

    try {
      const response = await fetch('/api/analyze-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          youtubeUrl: youtubeUrlForTranscript,
          modelType: analysisModel,
          transcriptionText: transcriptionToAnalyze,
          saveReport: false // Don't auto-save, let user decide
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      setTranscriptionResultContent(data.reportContent);

    } catch (err) {
      console.error("Error calling analyze-transcription API:", err);
      setTranscriptionResultError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsAnalyzingTranscript(false);
    }
  };

  const handleSaveTranscriptionAnalysis = async () => {
    if (!transcriptionResultContent || !analysisTypeForSave || !youtubeUrl) {
      setError("Cannot save analysis: Missing content, analysis type, or original URL.");
      return;
    }
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtube_url: youtubeUrl,
          analysis_type: analysisTypeForSave,
          report_content: transcriptionResultContent,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save analysis');
      }
      // Analysis saved, maybe clear current analysis or give feedback
      console.log("Analysis saved successfully!");
      setTranscriptionResultContent(null);
      setAnalysisTypeForSave(null);
      await fetchReports(); // Refresh the list of saved analyses
    } catch (err) {
      console.error("Error saving analysis:", err);
      setError(err instanceof Error ? err.message : "Could not save the analysis.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Section Title */}
      <div>
        <h3 className="text-lg font-medium">YouTube Video Analysis</h3>
        <p className="text-sm text-muted-foreground">
          Analyze YouTube videos for content insights and production quality feedback.
        </p>
      </div>
      <Separator />

      {/* YouTube URL Input Card */}
      <Card className="bg-card/60 backdrop-blur-sm border border-[hsl(var(--border))]/50 smooth-transition card-hover">
        <CardHeader>
          <CardTitle className="text-base">Input Video URL</CardTitle> {/* Adjusted size */}
        </CardHeader>
        <CardContent>
          <YoutubeInput 
            value={youtubeUrl}
            onChange={setYoutubeUrl}
            onValidated={handleYoutubeValidation}
            disabled={isLoading}
            // Removed label, relying on CardTitle
          />
          
          {/* Video Info Display */}
          {videoInfo?.duration && (
            <div className="mt-3">
              <p className={`text-xs ${videoInfo.duration > VIDEO_LENGTH_WARNING_MINUTES ? "text-amber-400 font-medium" : "text-muted-foreground"}`}>
                Estimated Duration: {videoInfo.duration} minutes
              </p>
            </div>
          )}
          
          {/* Size Warning Message */}
          {showSizeWarning && (
            <Alert className="mt-4 border-amber-500/40 bg-amber-500/10 text-xs p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="ml-2 text-amber-400">
                Video length might exceed limits for full analysis. Consider Audio Only.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          <Button
            onClick={() => handleAnalyze('video')}
            disabled={isLoading || !youtubeUrl}
            variant="default"
            className="bg-gradient-purple-pink hover:opacity-90"
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>
            ) : (
              <><Play className="mr-2 h-4 w-4" />Analyze Full Video</>
            )}
          </Button>
          
          <Button
            onClick={() => handleAnalyze('audio')}
            disabled={isLoading || !youtubeUrl}
            variant="outline"
            className="border-pink-600/40 text-pink-600 hover:border-pink-600 hover:bg-pink-600/10"
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>
            ) : (
              <><Music className="mr-2 h-4 w-4" />Analyze Audio Only</>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Results Card */}
      <Card className="bg-card/60 backdrop-blur-sm border border-[hsl(var(--border))]/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between"> {/* Adjusted size */}
            <span>Analysis Report</span>
            {reportContent && !isLoading && (
              <Button
                onClick={handleSaveReport}
                size="sm"
                variant="outline" // Changed variant
                className="border-green-600/40 text-green-600 hover:border-green-600 hover:bg-green-600/10"
              >
                <FileCheck className="mr-2 h-4 w-4" />
                Save Report
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="min-h-[200px]">
          {isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-4 py-8">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-muted-foreground">Analyzing your content...</p>
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[80%]" />
              </div>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive" className="my-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {reportContent && !error && (
            <div className="prose-custom">
              <ReactMarkdown>{reportContent}</ReactMarkdown>
            </div>
          )}
          
          {!isLoading && !error && !reportContent && (
            <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
              <TextSearch className="h-12 w-12 mb-4 opacity-30" />
              <p>Enter a URL and click Analyze to see the report here.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* 
        NOTE: The Transcription and Reports sections have been removed from this page.
        Their functionality would need to be moved to separate pages 
        (e.g., /transcription, /reports) and routed via the sidebar navigation.
      */}
    </div>
  );
}


