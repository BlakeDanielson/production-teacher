"use client"; // Required for useState and event handlers

import { useState, useEffect } from "react"; // Added useEffect
import ReactMarkdown from "react-markdown";
import FileUpload from "@/components/FileUpload";
import JobStatusDisplay from "@/components/JobStatusDisplay";
import YoutubeInput from "@/components/YoutubeInput";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

// Icons
import { Play, Music, FileCheck, Loader2, Check, AlertTriangle, TextSearch, Youtube, BarChart } from "lucide-react";

type AnalysisType = 'video' | 'audio';
type TranscriptionQuality = 'low' | 'medium' | 'high';
type TranscriptionFormat = 'mp3' | 'wav' | 'm4a';

// Constants for warnings
const VIDEO_LENGTH_WARNING_MINUTES = 10; // Warn for videos longer than 10 minutes
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
  const [analysisModel, setAnalysisModel] = useState<'gemini' | 'gpt'>('gemini');
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
      // If we have a valid URL with video info, update our state
      setVideoInfo(prev => ({
        ...prev,
        id: info.id,
        title: info.title,
        thumbnailUrl: info.thumbnailUrl,
        // We're keeping any duration info we might have from elsewhere
      }));
      setShowSizeWarning(false);
      setError(null);
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
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 lg:p-12 bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <Card className="w-full mb-12 border-none bg-transparent shadow-none">
          <CardContent className="p-0">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center animated-gradient-text">
              Production Teacher
            </h1>
            <p className="text-center text-muted-foreground max-w-xl mx-auto">
              AI-powered analysis and insights for video creators, helping you craft better content and improve your production quality.
            </p>
          </CardContent>
        </Card>

        {/* Updated Input Section with YoutubeInput */}
        <div className="mb-6 p-6 bg-gray-800 rounded-lg shadow-lg">
          <YoutubeInput 
            value={youtubeUrl}
            onChange={setYoutubeUrl}
            onValidated={handleYoutubeValidation}
            disabled={isLoading}
            label="YouTube Video URL"
          />
          
          {/* Video Info Display - simplified since YoutubeInput shows preview */}
          {videoInfo?.duration && (
            <div className="mt-2 text-sm">
              <p className={`text-gray-400 ${videoInfo.duration > VIDEO_LENGTH_WARNING_MINUTES ? "text-amber-400 font-medium" : ""}`}>
                Estimated Duration: {videoInfo.duration} minutes
              </p>
            </div>
          )}
          
          {/* Size Warning Message */}
          {showSizeWarning && (
            <div className="mt-2 p-3 bg-amber-900/50 border border-amber-700 rounded-md">
              <p className="text-amber-400 text-sm">
                <strong>⚠️ Warning:</strong> This video appears to be {videoInfo?.duration} minutes long, which might be too large for full video analysis.
                Consider using the <strong>Audio Only</strong> option for longer content.
              </p>
            </div>
          )}
          
          <div className="flex justify-center space-x-4 mt-4">
            <button
              onClick={() => handleAnalyze('video')}
              disabled={isLoading || !youtubeUrl}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white font-semibold rounded-md shadow transition-colors"
            >
              {isLoading ? "Analyzing..." : "Analyze Full Video"}
            </button>
            <button
              onClick={() => handleAnalyze('audio')}
              disabled={isLoading || !youtubeUrl}
              className="px-6 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-500 text-white font-semibold rounded-md shadow transition-colors"
            >
              {isLoading ? "Analyzing..." : "Analyze Audio Only"}
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="mt-8 p-6 bg-gray-800 rounded-lg shadow-lg min-h-[200px]">
          <h2 className="text-2xl font-semibold mb-4 text-gray-300">Analysis Report</h2>
          {isLoading && <p className="text-center text-gray-400">Analyzing, please wait...</p>}
          {error && <p className="text-center text-red-400 bg-red-900 p-3 rounded">{error}</p>}
          {reportContent && !error && (
            <div className="prose prose-invert max-w-none prose-headings:text-purple-400 prose-a:text-pink-500 hover:prose-a:text-pink-400">
              <ReactMarkdown>{reportContent}</ReactMarkdown>
            </div>
          )}
           {!isLoading && !error && !reportContent && (
             <p className="text-center text-gray-500">Enter a URL and click Analyze to see the report here.</p>
           )}
           {/* Save Button */}
           {reportContent && !error && !isLoading && (
             <div className="mt-4 text-center">
               <button
                 onClick={handleSaveReport}
                 className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow transition duration-200 ease-in-out"
               >
                 Save This Report
               </button>
             </div>
            )}
        </div>

        {/* Saved Reports Section */}
        <div className="mt-10 p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-gray-300">Saved Reports</h2>
          {savedReports.length === 0 && (
            <p className="text-center text-gray-500">No reports saved yet.</p>
          )}
          {savedReports.length > 0 && (
            <div> {/* Container for list and button */}
              <ul className="space-y-3">
                {savedReports.map((report) => (
                  <li key={report.id} className="flex justify-between items-center p-3 bg-gray-700 rounded-md shadow">
                    <div className="flex items-center space-x-3 flex-grow min-w-0"> {/* Flex container for checkbox and text */}
                       <input
                         type="checkbox"
                         id={`report-${report.id}`}
                         checked={selectedReportIds.has(report.id)}
                         onChange={(e) => handleCheckboxChange(report.id, e.target.checked)}
                         className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                       />
                       <div className="min-w-0"> {/* Ensure text truncates */}
                         <p className="text-sm text-gray-400">ID: {report.id.substring(0, 8)}...</p>
                         <p className="text-gray-200 truncate" title={report.youtube_url}>{report.youtube_url}</p>
                         <p className="text-xs text-gray-500">
                           Analyzed ({report.analysis_type}) on {new Date(report.created_at).toLocaleString()}
                         </p>
                       </div>
                    </div>
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-md shadow transition duration-200 ease-in-out flex-shrink-0" // Prevent button shrinking
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
              {/* Synthesis Button */}
              {savedReports.length >= 2 && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleSynthesize}
                    disabled={isSynthesizing || selectedReportIds.size < 2}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-semibold rounded-md shadow transition duration-200 ease-in-out"
                  >
                    {isSynthesizing ? "Synthesizing..." : `Synthesize Selected (${selectedReportIds.size}) Reports`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Synthesis Results Section */}
        <div className="mt-10 p-6 bg-gray-800 rounded-lg shadow-lg min-h-[150px]">
           <h2 className="text-2xl font-semibold mb-4 text-gray-300">Synthesized Insights</h2>
           {isSynthesizing && <p className="text-center text-gray-400">Synthesizing insights, please wait...</p>}
           {synthesisError && <p className="text-center text-red-400 bg-red-900 p-3 rounded">{synthesisError}</p>}
           {synthesisResult && !synthesisError && (
             <div className="prose prose-invert max-w-none prose-headings:text-blue-400 prose-a:text-pink-500 hover:prose-a:text-pink-400">
               <ReactMarkdown>{synthesisResult}</ReactMarkdown>
             </div>
           )}
           {!isSynthesizing && !synthesisError && !synthesisResult && (
             <p className="text-center text-gray-500">Select two or more saved reports and click Synthesize to see insights here.</p>
           )}
        </div>

        {/* Transcription Testing Section */}
        <div className="mt-10 p-6 bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl">
          <h2 className="text-2xl font-semibold mb-4 text-gray-300">Transcription</h2>
          <p className="text-gray-400 mb-4">
            Upload an audio or video file to transcribe it. Maximum file size: 25MB.
          </p>
          
          <div className="mb-4">
            <FileUpload 
              onFileSelect={(file) => setSelectedFile(file)}
              maxSizeMB={25}
              disabled={isTranscribing}
              label="Drag and drop an audio or video file here, or click to select"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="quality" className="block text-sm font-medium mb-2 text-gray-300">
                Audio Quality:
              </label>
              <select
                id="quality"
                value={transcriptionQuality}
                onChange={(e) => setTranscriptionQuality(e.target.value as TranscriptionQuality)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-100"
                disabled={isTranscribing}
              >
                <option value="low">Low (Smaller File)</option>
                <option value="medium">Medium (Balanced)</option>
                <option value="high">High (Better Quality)</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="format" className="block text-sm font-medium mb-2 text-gray-300">
                Audio Format:
              </label>
              <select
                id="format"
                value={transcriptionFormat}
                onChange={(e) => setTranscriptionFormat(e.target.value as TranscriptionFormat)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-100"
                disabled={isTranscribing}
              >
                <option value="mp3">MP3</option>
                <option value="wav">WAV</option>
                <option value="m4a">M4A</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 text-center">
            <button
              onClick={handleTranscribe}
              disabled={isTranscribing || !selectedFile}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-semibold rounded-md shadow transition-colors"
            >
              {isTranscribing ? "Processing..." : "Transcribe File"}
            </button>
          </div>
          
          {/* Show job status if we have a job ID */}
          {transcriptionJobId && (
            <JobStatusDisplay
              jobId={transcriptionJobId}
              onComplete={handleTranscriptionComplete}
              onError={handleTranscriptionError}
            />
          )}
          
          {transcriptionError && !transcriptionJobId && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-md">
              <p className="text-red-400 text-sm">{transcriptionError}</p>
            </div>
          )}
          
          {transcriptionResult && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2 text-gray-300">Transcription Result:</h3>
              <div className="p-4 bg-gray-700 rounded-md max-h-60 overflow-y-auto">
                <p className="text-gray-200 whitespace-pre-wrap">{transcriptionResult}</p>
              </div>
              <div className="mt-3 flex justify-end">
                <button 
                  onClick={() => {
                    setTranscriptionToAnalyze(transcriptionResult);
                    setTranscriptionResultError(null);
                    
                    // Auto-scroll to analysis section
                    document.getElementById('analyze-transcription-section')?.scrollIntoView({ 
                      behavior: 'smooth',
                      block: 'start'
                    });
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded transition-colors"
                >
                  Use for Analysis
                </button>
              </div>
            </div>
          )}
        </div>

        {/* After the transcription testing section - Update the ID for scrolling */}
        <div id="analyze-transcription-section" className="mt-10 p-6 bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl">
          <h2 className="text-2xl font-semibold mb-4 text-gray-300">Analyze Transcription</h2>
          <p className="text-gray-400 mb-4">
            Choose a completed transcription to analyze, or enter a transcript directly.
          </p>
          
          {transcriptionResult && (
            <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-md">
              <p className="text-blue-300 text-sm">
                You have a successful transcription ready to analyze! 
                <button
                  onClick={() => {
                    setTranscriptionToAnalyze(transcriptionResult);
                    setTranscriptionResultError(null);
                  }}
                  className="ml-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                >
                  Use This Transcription
                </button>
              </p>
            </div>
          )}
          
          <div className="mb-4">
            <label htmlFor="transcriptionInput" className="block text-sm font-medium mb-2 text-gray-300">
              Enter Transcription Text:
            </label>
            <textarea
              id="transcriptionInput"
              value={transcriptionToAnalyze || ''}
              onChange={(e) => setTranscriptionToAnalyze(e.target.value)}
              placeholder="Paste transcription text here or use the transcription feature above..."
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-100 min-h-[100px]"
              disabled={isAnalyzingTranscript}
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="analysisModel" className="block text-sm font-medium mb-2 text-gray-300">
              Analysis Model:
            </label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="analysisModel"
                  value="gemini"
                  checked={analysisModel === 'gemini'}
                  onChange={() => setAnalysisModel('gemini')}
                  className="form-radio text-purple-600"
                  disabled={isAnalyzingTranscript}
                />
                <span className="ml-2 text-gray-300">Gemini (Default)</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="analysisModel"
                  value="gpt"
                  checked={analysisModel === 'gpt'}
                  onChange={() => setAnalysisModel('gpt')}
                  className="form-radio text-green-600"
                  disabled={isAnalyzingTranscript}
                />
                <span className="ml-2 text-gray-300">GPT-4</span>
              </label>
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="youtubeUrlForTranscript" className="block text-sm font-medium mb-2 text-gray-300">
              YouTube URL (Optional):
            </label>
            <input
              type="url"
              id="youtubeUrlForTranscript"
              value={youtubeUrlForTranscript || ''}
              onChange={(e) => setYoutubeUrlForTranscript(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... (helps with context)"
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-100"
              disabled={isAnalyzingTranscript}
            />
          </div>
          
          <div className="mt-4 flex justify-center space-x-4">
            <button
              onClick={handleAnalyzeTranscription}
              disabled={isAnalyzingTranscript || !transcriptionToAnalyze || transcriptionToAnalyze.length < 50}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-500 text-white font-semibold rounded-md shadow transition duration-200 ease-in-out"
            >
              {isAnalyzingTranscript ? "Analyzing..." : "Analyze Transcription"}
            </button>
            
            <button
              onClick={() => handleSaveTranscriptionAnalysis()}
              disabled={!transcriptionResultContent}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white font-semibold rounded-md shadow transition duration-200 ease-in-out"
            >
              Save Analysis
            </button>
          </div>
          
          {transcriptionResultError && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-md">
              <p className="text-red-400 text-sm">{transcriptionResultError}</p>
            </div>
          )}
          
          {transcriptionResultContent && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-3 text-gray-300">Analysis Results</h3>
              <div className="prose prose-invert max-w-none prose-headings:text-purple-400 prose-a:text-pink-500 hover:prose-a:text-pink-400">
                <ReactMarkdown>{transcriptionResultContent}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}


