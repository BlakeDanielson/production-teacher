import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { supabase } from '@/lib/supabaseClient'; // Assuming you might use this later
import { extractYoutubeVideoId } from '@/lib/youtubeApi';
import path from 'path';
import fsPromises from 'fs/promises'; // Use promises API for async operations
import fs from 'fs'; // Import standard fs for sync operations
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { updateProgress, generateAnalysisId } from '@/lib/progressTrackerServer'; // Import the server version

const execPromise = promisify(exec);
const TEMP_DIR = path.join(os.tmpdir(), 'production_teacher_media'); // Use OS temp dir

// Add debugging info
const DEBUG = true;
const logDebug = (...args: any[]) => {
  if (DEBUG) {
    console.log(...args);
  }
};

// Add detailed timing logs
const startTimers: Record<string, number> = {};

function startTimer(label: string): string {
  startTimers[label] = Date.now();
  return label;
}

function endTimer(label: string): number {
  if (!startTimers[label]) {
    console.warn(`Timer "${label}" not found`);
    return 0;
  }
  const elapsed = Date.now() - startTimers[label];
  delete startTimers[label];
  return elapsed;
}

// Ensure temp directory exists
async function ensureTempDir() {
    try {
        await fsPromises.mkdir(TEMP_DIR, { recursive: true });
    } catch (error) {
        // Check if error is an object with a code property
        if (error && typeof error === 'object' && 'code' in error && error.code !== 'EEXIST') {
            console.error("Failed to create temp directory:", error);
            throw error; 
        } else if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) {
             // Re-throw if it's not the EEXIST error we expect to ignore
             console.error("Unexpected error creating temp directory:", error);
             throw error;
        }
    }
}

// Function to download media using yt-dlp-exec
async function downloadMedia(youtubeUrl: string, format: 'video' | 'audio'): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
    await ensureTempDir();
    const videoId = extractYoutubeVideoId(youtubeUrl);
    if (!videoId) throw new Error('Invalid YouTube URL for download');

    const fileExtension = format === 'video' ? 'mp4' : 'mp3';
    // Use a more robust temporary filename
    const tempFilePath = path.join(TEMP_DIR, `media_${videoId}_${Date.now()}.${fileExtension}`);

    const formatOption = format === 'video' ? 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' : 'bestaudio[ext=m4a]/bestaudio/best';
    const postprocessorArgs = format === 'audio' ? '-x --audio-format mp3' : '';
    const command = `yt-dlp -f "${formatOption}" ${postprocessorArgs} -o "${tempFilePath}" -- "${youtubeUrl}"`;

    console.log(`Executing command: ${command}`);
    try {
        const { stdout, stderr } = await execPromise(command, { maxBuffer: 1024 * 1024 * 50 }); // Increased buffer
        if (stderr && !stderr.includes('Deleting original file')) { // Ignore ffmpeg cleanup message
             console.warn(`yt-dlp stderr: ${stderr}`);
        }
        console.log(`yt-dlp stdout: ${stdout}`);
        
        // Check if the file was actually created
        await fsPromises.access(tempFilePath); 
        console.log(`File downloaded successfully: ${tempFilePath}`);
        
    } catch (error) {
        console.error(`Error executing yt-dlp: ${error}`);
        // Attempt to cleanup partial file if exists
        if (fs.existsSync(tempFilePath)) {
            try { await fsPromises.unlink(tempFilePath); } catch (_) {}
        }
        // Construct error message safely
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to download media using yt-dlp. Error: ${errorMessage}`);
    }

    const cleanup = async () => {
        if (fs.existsSync(tempFilePath)) {
            try {
                await fsPromises.unlink(tempFilePath);
                console.log(`Cleaned up temporary file: ${tempFilePath}`);
            } catch (cleanupError) {
                console.error(`Error cleaning up temporary file ${tempFilePath}:`, cleanupError);
            }
        }
    };

    // Ensure the correct path is returned (yt-dlp might change extension for audio)
    const finalPath = format === 'audio' ? tempFilePath.replace(/\.mp4$/, '.mp3') : tempFilePath;
    if (!fs.existsSync(finalPath)) {
        // If the expected final path doesn't exist, check if the original temp path exists
        if (fs.existsSync(tempFilePath)) {
             console.warn(`Expected final path ${finalPath} not found, using ${tempFilePath}`);
             return { filePath: tempFilePath, cleanup };
        } else {
            throw new Error(`Downloaded file not found at expected paths: ${finalPath} or ${tempFilePath}`);
        }
    }

    return { filePath: finalPath, cleanup };
}

// Analyze content using Gemini
async function analyzeContentWithGemini(filePath: string, analysisType: 'video' | 'audio', apiKey: string, customPrompt?: string): Promise<string> { // Ensure return type is string
  if (!apiKey) {
    throw new Error("Gemini API Key is missing.");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Use appropriate model
  
  console.log(`Analyzing content: ${filePath}`);
  const fileStats = await fsPromises.stat(filePath);
  if (fileStats.size === 0) {
      throw new Error("Content file is empty.");
  }
  // Add size checks if needed

  const fileData = await fsPromises.readFile(filePath);
  const mimeType = analysisType === 'video' ? 'video/mp4' : 'audio/mpeg'; // Correct MIME for mp3

  const generationConfig = {
    temperature: 0.7,
    maxOutputTokens: 8192,
  };
  const safetySettings = [
       { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
       { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
       { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
       { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];
  const parts = [
       { text: customPrompt || getAnalysisPrompt() },
       {
         inlineData: {
           mimeType: mimeType,
           data: fileData.toString("base64"),
         },
       },
  ];

  try {
    const result = await model.generateContent({ contents: [{ role: "user", parts }], generationConfig, safetySettings });
    if (!result.response) throw new Error("Gemini API Error: No response object.");
    
    const responseText = result.response.text();
    if (!responseText) {
        if (result.response.promptFeedback?.blockReason) {
             throw new Error(`Content blocked by Gemini: ${result.response.promptFeedback.blockReason}`);
        }
        throw new Error("Gemini API returned an empty response.");
    }
    return responseText; // Return the text
  } catch (error) {
     console.error("Error during Gemini API call:", error);
     // Construct error message safely
     const errorMessage = error instanceof Error ? error.message : String(error);
     throw new Error(`Gemini analysis failed: ${errorMessage}`);
  }
}

// Simple prompt for demonstration
function getAnalysisPrompt(): string {
  return "Analyze the provided media (video or audio). Provide a concise summary, identify key topics/segments, suggest potential improvements for engagement (e.g., pacing, clarity, visuals if applicable), and give an overall quality score (1-10). Format the response using Markdown.";
}

// Define interface for request body
interface RequestBody {
  youtubeUrl: string;
  analysisType: 'video' | 'audio';
  googleApiKey: string;
  customPrompt?: string;
  jobId?: string; // Add jobId parameter
}

// POST handler for the analyze endpoint
export async function POST(request: Request) {
  // Declare jobId in the outer scope so it's available in all catch blocks
  let extractedJobId: string | undefined;
  
  try {
    const data = await request.json() as RequestBody;
    const { youtubeUrl, analysisType, googleApiKey, customPrompt, jobId } = data;
    
    // Store the jobId for use in catch blocks
    extractedJobId = jobId;
    
    if (!youtubeUrl) {
      return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 });
    }
    
    if (!googleApiKey) {
      return NextResponse.json({ error: "Google API key is required" }, { status: 400 });
    }
    
    // Log initial request
    console.log(`Analysis request received (Job ID: ${jobId || 'none'})`);
    
    // Update progress: Validating stage
    if (jobId) {
      updateProgress(jobId, 'validating', 10, 'Validating YouTube URL and preparing analysis');
    }
    
    // Extract YouTube ID
    const youtubeId = extractYoutubeVideoId(youtubeUrl);
    if (!youtubeId) {
      if (jobId) {
        updateProgress(jobId, 'error', 0, 'Invalid YouTube URL provided');
      }
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }
    
    // Update progress: Downloading stage
    if (jobId) {
      updateProgress(jobId, 'downloading', 20, 'Downloading media from YouTube...');
    }
    
    // Try to download the content
    try {
      const { filePath, cleanup } = await downloadMedia(youtubeUrl, analysisType);
      console.log(`File downloaded successfully: ${filePath}`);
      
      // Check file size - videos too large may fail
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      
      // Update progress: Processing stage with file size info
      if (jobId) {
        updateProgress(
          jobId, 
          'processing', 
          50, 
          `Downloaded ${Math.round(fileSizeInMB * 10) / 10}MB, preparing for analysis`
        );
      }
      
      if (fileSizeInMB > 100) {
        if (jobId) {
          updateProgress(jobId, 'error', 0, `Video file is too large (${Math.round(fileSizeInMB)}MB). Please try a shorter video or use audio-only analysis.`);
        }
        await cleanup();
        return NextResponse.json({ 
          error: `Video file is too large (${Math.round(fileSizeInMB)}MB). Please try a shorter video or use audio-only analysis.`,
          jobId
        }, { status: 400 });
      }

      // Update progress: Analyzing stage
      if (jobId) {
        updateProgress(jobId, 'analyzing', 70, 'Running AI analysis on media content...');
      }
      
      // Analyze the content
      try {
        console.log(`Analyzing content: ${filePath}`);
        // Pass in custom prompt if provided
        const reportContent = await analyzeContentWithGemini(filePath, analysisType, googleApiKey, customPrompt);
        
        // Update progress: Analyzing_pending stage (waiting for final processing)
        if (jobId) {
          updateProgress(jobId, 'analyzing_pending', 90, 'Finalizing analysis results...');
        }
        
        // Clean up after successful analysis
        await cleanup();
        console.log(`✅ Analysis complete for job ${jobId || 'none'}`);
        
        // Update progress: Complete stage
        if (jobId) {
          updateProgress(jobId, 'complete', 100, 'Analysis complete!');
        }
        
        return NextResponse.json({ 
          reportContent,
          jobId
        });
      } catch (analysisError) {
        // Update progress: Error stage
        if (jobId) {
          updateProgress(
            jobId, 
            'error', 
            0, 
            `Analysis failed: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`
          );
        }
        
        await cleanup();
        console.error("Error during analysis:", analysisError instanceof Error ? analysisError.message : String(analysisError));
        return NextResponse.json({ 
          error: `Analysis failed: ${analysisError instanceof Error ? analysisError.message : String(analysisError)}`,
          jobId 
        }, { status: 500 });
      }
    } catch (downloadError) {
      // Update progress: Error stage for download failures
      if (jobId) {
        updateProgress(
          jobId, 
          'error', 
          0, 
          `Download failed: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`
        );
      }
      
      console.error("Error downloading media:", downloadError instanceof Error ? downloadError.message : String(downloadError));
      return NextResponse.json({ 
        error: `Failed to download media: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`,
        jobId 
      }, { status: 500 });
    }
  } catch (error) {
    // Update progress: Error stage for any other errors  
    if (extractedJobId) {
      updateProgress(
        extractedJobId, 
        'error', 
        0, 
        `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    
    console.error("Error in analyze API:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ 
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`,
      jobId: extractedJobId || null
    }, { status: 500 });
  }
}