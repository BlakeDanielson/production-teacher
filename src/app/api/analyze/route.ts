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
  // Create a temporary file path
  const tempFilePath = path.join(os.tmpdir(), 'production_teacher_media', `media_${Math.random().toString(36).substring(7)}_${Date.now()}.mp4`);
  
  try {
    const data = await request.json() as RequestBody;
    const { youtubeUrl, analysisType, googleApiKey, customPrompt, jobId } = data;
    
    if (!youtubeUrl) {
      return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 });
    }
    
    if (!googleApiKey) {
      return NextResponse.json({ error: "Google API key is required" }, { status: 400 });
    }
    
    // Log initial request
    console.log(`Analysis request received (Job ID: ${jobId || 'none'})`);
    
    // Extract YouTube ID
    const youtubeId = getYoutubeId(youtubeUrl);
    if (!youtubeId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }
    
    // Make sure temp directory exists
    const mediaDir = path.join(os.tmpdir(), 'production_teacher_media');
    try {
      await fsPromises.mkdir(mediaDir, { recursive: true });
    } catch (err) {
      // Directory likely exists, continue
    }
    
    // Set unique file path with YouTube ID
    const tempPath = path.join(os.tmpdir(), 'production_teacher_media', `media_${youtubeId}_${Date.now()}.mp4`);
    
    // Download the video
    console.log(`Processing ${analysisType} analysis for YouTube URL: ${youtubeUrl}`);
    
    try {
      await downloadYoutubeVideo(youtubeUrl, tempPath);
      console.log(`File downloaded successfully: ${tempPath}`);
    } catch (downloadError) {
      console.error("Error downloading video:", downloadError);
      return NextResponse.json({ 
        error: `Failed to download video: ${downloadError.message}`,
        jobId 
      }, { status: 500 });
    }
    
    // Check file size - videos too large may fail
    const stats = fsSync.statSync(tempPath);
    
    const fileSizeInMB = stats.size / (1024 * 1024);
    if (fileSizeInMB > 100) {
      return NextResponse.json({ 
        error: `Video file is too large (${Math.round(fileSizeInMB)}MB). Please try a shorter video or use audio-only analysis.`,
        jobId
      }, { status: 400 });
    }

    // Analyze the content
    try {
      console.log(`Analyzing content: ${tempPath}`);
      // Pass in custom prompt if provided
      const reportContent = await analyzeContentWithGemini(tempPath, analysisType, googleApiKey, customPrompt);
      
      console.log(`✅ Analysis complete in ${Date.now() - tempPath.split("_").pop().split(".")[0]}ms (Job ID: ${jobId || 'none'})`);
      
      return NextResponse.json({ 
        reportContent,
        jobId,
        processingTimeMs: Date.now() - tempPath.split("_").pop().split(".")[0]
      });
    } catch (analysisError) {
      console.error("Error during analysis:", analysisError);
      return NextResponse.json({ 
        error: `Analysis failed: ${analysisError.message}`,
        jobId 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error in analyze API:", error);
    return NextResponse.json({ 
      error: `An unexpected error occurred: ${error.message}`,
      jobId: (request.json().then(data => data.jobId).catch(() => null))
    }, { status: 500 });
  } finally {
    // Clean up the temp file regardless of success or failure
    if (fsSync.existsSync(tempFilePath)) {
      try {
        fsSync.unlinkSync(tempFilePath);
        console.log(`Cleaned up temporary file: ${tempFilePath}`);
        console.log(`🧹 Cleaned up temporary media file`);
      } catch (cleanupError) {
        console.error("Error cleaning up temp file:", cleanupError);
      }
    }
  }
}

// Analyze using Google's Gemini model
async function analyzeWithGemini(
  genAI: GoogleGenerativeAI,
  filePath: string,
  youtubeUrl: string,
  mediaType: 'video' | 'audio',
  customPrompt?: string
): Promise<string> {
  // Prepare model config
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro-latest",
  });
  
  // Load media file
  const mediaData = await fs.promises.readFile(filePath);
  
  // Create parts for the model
  const parts: Part[] = [
    { text: customPrompt || getAnalysisPrompt() },
    { text: `\nMedia Type: ${mediaType === 'video' ? 'Video' : 'Audio'}\nSource: ${youtubeUrl}\n\n` },
  ];
  
  // Add the media data
  if (mediaType === 'video') {
    parts.push({
      inlineData: {
        mimeType: "video/mp4",
        data: mediaData.toString('base64')
      },
    });
  } else {
    parts.push({
      inlineData: {
        mimeType: "audio/mpeg",
        data: mediaData.toString('base64')
      },
    });
  }

  // Configure generation parameters
  const generationConfig = {
    temperature: 0.7,
    topK: 32,
    topP: 0.95,
    maxOutputTokens: 4096,
  };
  
  // Configure safety settings
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
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

// Define types for Gemini parts
interface TextPart {
  text: string;
}

interface InlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  }
}

type Part = TextPart | InlineDataPart;
