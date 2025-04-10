import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { supabase } from '@/lib/supabaseClient'; // Assuming you might use this later
import { extractYoutubeVideoId } from '@/lib/youtubeApi';
import path from 'path';
import fsPromises from 'fs/promises'; // Use promises API for async operations
import fs from 'fs'; // Import standard fs for sync operations
import os from 'os';
// Removed: import { exec } from 'child_process';
// Removed: import { promisify } from 'util';
import { updateProgress } from '@/lib/progressTrackerServer'; // Import the server version - Keep for now, might be used differently
import { createJob } from '@/lib/jobQueue'; // Import createJob

// Removed: const execPromise = promisify(exec);
const TEMP_DIR = path.join(os.tmpdir(), 'production_teacher_media'); // Use OS temp dir - Keep for now, might be needed by worker

// --- Configuration ---
const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

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

// Function to download media using yt-dlp-exec - REMOVED due to Vercel incompatibility
// async function downloadMedia(...) { ... } // REMOVED

// Analyze content using Gemini - This function belongs in the worker, not the API route. REMOVED.
/*
async function analyzeContentWithGemini(...) { ... }
*/

// Simple prompt for demonstration - This belongs with the worker logic. REMOVED.
/*
function getAnalysisPrompt(): string { ... }
*/
// Define interface for request body
interface RequestBody {
  youtubeUrl: string;
  analysisType: 'video' | 'audio';
  // googleApiKey: string; // REMOVED - Use environment variable
  customPrompt?: string;
  jobId?: string; // Add jobId parameter
}

// POST handler for the analyze endpoint
export async function POST(request: Request) {
  // Declare jobId in the outer scope so it's available in all catch blocks
  let extractedJobId: string | undefined;
  
  try {
    // Check for API Key availability early
    if (!GEMINI_API_KEY) {
        console.error("CRITICAL: GOOGLE_GEMINI_API_KEY is not set on the server.");
        return NextResponse.json({ error: "Server configuration error: Missing API key." }, { status: 500 });
    }

    const data = await request.json() as RequestBody;
    // Remove googleApiKey from destructuring
    const { youtubeUrl, analysisType, customPrompt } = data; // Removed jobId from here, it's not sent by client

    if (!youtubeUrl) {
      return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 });
    }
    if (!analysisType || (analysisType !== 'video' && analysisType !== 'audio')) {
        return NextResponse.json({ error: "Invalid analysisType" }, { status: 400 });
    }

    // Log initial request
    console.log(`Analysis request received for URL: ${youtubeUrl}`);

    // Extract YouTube ID for validation
    const youtubeId = extractYoutubeVideoId(youtubeUrl);
    if (!youtubeId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    // --- Create Job ---
    try {
        const jobMetadata = {
            youtubeUrl,
            analysisType,
            ...(customPrompt && { customPrompt }) // Include customPrompt if provided
        };
        const newJob = await createJob('analysis', jobMetadata);
        console.log(`Created analysis job with ID: ${newJob.id}`);

        // Return the job ID to the client
        return NextResponse.json(newJob, { status: 202 }); // 202 Accepted

    } catch (jobError) {
        console.error("Error creating analysis job:", jobError);
        return NextResponse.json({ error: "Failed to create analysis job." }, { status: 500 });
    }

  } catch (error) {
    // Catch errors during request parsing or initial validation
    console.error("Error in analyze API:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 });
  }
}
