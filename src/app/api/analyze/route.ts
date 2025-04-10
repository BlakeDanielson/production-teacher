import { NextResponse } from 'next/server'; // Removed unused type NextRequest
// Removed unused GoogleGenerativeAI, HarmCategory, HarmBlockThreshold
// Removed unused supabase
import { extractYoutubeVideoId } from '@/lib/youtubeApi';
// Removed unused path import
// Removed unused fsPromises
// Removed unused fs
// Removed unused os import
// Removed: import { exec } from 'child_process';
// Removed: import { promisify } from 'util';
// Removed unused updateProgress
import { createJob } from '@/lib/jobQueue'; // Import createJob

// Removed: const execPromise = promisify(exec);
// Removed unused TEMP_DIR constant

// --- Configuration ---
const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

// Removed unused DEBUG constant and logDebug function
// Removed unused startTimers variable, startTimer function, and endTimer function
// Removed unused ensureTempDir function

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
export async function POST(request: Request) { // Note: 'Request' type comes from Next/server implicitly or globally
  // Removed unused variable declaration: let extractedJobId: string | undefined;

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
