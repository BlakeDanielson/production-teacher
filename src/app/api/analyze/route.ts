import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { exec } from 'child_process'; // For running yt-dlp/ffmpeg
import fs from 'fs/promises'; // For file system operations
import path from 'path'; // For handling file paths
import { promisify } from 'util'; // To promisify exec

const execPromise = promisify(exec);

// --- Configuration ---
const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const TEMP_DIR = path.join(process.cwd(), 'tmp_media'); // Directory to store temporary downloads
const MAX_FILE_SIZE_MB = 250; // Reduced from 900MB to 250MB for safety with Gemini API
const GEMINI_MAX_SIZE_BYTES = 300 * 1024 * 1024; // 300MB, Gemini's actual limit

if (!GEMINI_API_KEY) {
  console.error("ERROR: GOOGLE_GEMINI_API_KEY environment variable is not set.");
  // Avoid throwing here during build time, handle in request instead
}

// --- Gemini Client Initialization ---
let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  console.warn("Gemini API Key not found. API calls will fail.");
}

// --- Helper Functions ---

// Function to ensure temporary directory exists
async function ensureTempDirExists() {
  try {
    await fs.access(TEMP_DIR);
  } catch {
    // Directory does not exist, create it
    await fs.mkdir(TEMP_DIR, { recursive: true });
    console.log(`Created temporary directory: ${TEMP_DIR}`);
  }
}

// Function to download video/audio using yt-dlp
async function downloadMedia(youtubeUrl: string, analysisType: 'video' | 'audio'): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  await ensureTempDirExists();
  const uniqueId = Date.now(); // Simple unique ID for temp file
  const outputFormat = analysisType === 'video'
    ? `%(id)s_${uniqueId}.%(ext)s` // Keep original extension if possible for video
    : `%(id)s_${uniqueId}.mp3`; // Force mp3 for audio
  const outputPath = path.join(TEMP_DIR, outputFormat); // yt-dlp replaces placeholders

  // yt-dlp command construction
  const commandOptions = analysisType === 'video'
    ? `-f "bestvideo[ext=mp4][filesize<?${MAX_FILE_SIZE_MB}M]+bestaudio[ext=m4a]/best[ext=mp4][filesize<?${MAX_FILE_SIZE_MB}M]/best[filesize<?${MAX_FILE_SIZE_MB}M]" --merge-output-format mp4` // Prefer mp4, limit size
    : `-x --audio-format mp3 --audio-quality 0`; // Extract best audio as mp3

  const command = `yt-dlp ${commandOptions} -o "${outputPath}" -- "${youtubeUrl}"`; // Ensure URL is last and quoted

  console.log(`Executing download command: ${command}`);

  try {
    const { stdout, stderr } = await execPromise(command, { timeout: 300000 }); // 5 min timeout
    console.log('yt-dlp stdout:', stdout);
    if (stderr) {
      console.warn('yt-dlp stderr:', stderr); // Log stderr as warning, check output file
    }

    // yt-dlp replaces the format placeholders, we need to find the actual created file
    const files = await fs.readdir(TEMP_DIR);
    const downloadedFile = files.find(file => file.includes(uniqueId.toString()));

    if (!downloadedFile) {
      throw new Error(`Failed to find downloaded file for ID ${uniqueId} in ${TEMP_DIR}. stderr: ${stderr}`);
    }

    const finalFilePath = path.join(TEMP_DIR, downloadedFile);
    console.log(`Download successful: ${finalFilePath}`);

    // Return file path and a cleanup function
    return {
      filePath: finalFilePath,
      cleanup: async () => {
        try {
          await fs.unlink(finalFilePath);
          console.log(`Cleaned up temporary file: ${finalFilePath}`);
        } catch (cleanupError) {
          console.error(`Error cleaning up file ${finalFilePath}:`, cleanupError);
        }
      }
    };
  } catch (error: unknown) {
    console.error('Error during media download:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown yt-dlp error';
    throw new Error(`Failed to download media: ${errorMessage}`);
  }
}

// Function to get the analysis prompt
function getAnalysisPrompt(): string {
  // Using the refined prompt from our planning phase
  return `
You are an expert AI assistant specialized in analyzing music production content. You will be provided with a video or audio file containing a music production tutorial, podcast, or discussion.

Your task is to carefully analyze the content and generate a structured report containing the following sections. Focus solely on the music production content. Ignore unrelated segments like introductions, sponsor reads, or personal anecdotes unless they directly contain a production tip or technique.

## Concise Summary
Provide a brief overview of the main topics discussed or demonstrated in the content. (2-4 sentences)

## Key Production Tips
List specific, actionable tips mentioned for improving music production. Ensure each item listed is actionable and provides clear guidance a producer could implement. (Use bullet points)
*   Example Tip 1
*   Example Tip 2

## Techniques Demonstrated/Discussed
Identify and describe any specific production techniques shown or explained (e.g., sidechain compression setup, specific EQ methods, sound design approaches). Ensure each item listed is actionable and provides clear guidance a producer could implement. (Use bullet points and brief descriptions)
*   Technique 1: Description...
*   Technique 2: Description...

## Tools & Software Mentioned
List any specific DAWs, plugins, hardware, or other tools mentioned. (Use bullet points)
*   Tool/Plugin 1
*   Hardware 1

## Actionable Advice
Extract any general advice given to producers regarding workflow, creativity, learning, etc. Ensure each item listed is actionable and provides clear guidance a producer could implement. (Use bullet points)
*   Advice 1
*   Advice 2

Please format the entire output using Markdown with clear level-2 headings (e.g., \`## Summary\`, \`## Key Production Tips\`) for each section. Focus on extracting practical and useful information for a music producer.
  `.trim();
}


// --- API Route Handler (POST) ---
export async function POST(request: NextRequest) {
  console.log("Received POST request to /api/analyze");

  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check API key.' }, { status: 500 });
  }

  let downloadResult: { filePath: string; cleanup: () => Promise<void> } | null = null;

  try {
    const body = await request.json();
    const { youtubeUrl, analysisType } = body;

    console.log(`Request body:`, body);


    // --- Input Validation ---
    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid youtubeUrl' }, { status: 400 });
    }
    if (!analysisType || (analysisType !== 'video' && analysisType !== 'audio')) {
      return NextResponse.json({ error: 'Missing or invalid analysisType (must be "video" or "audio")' }, { status: 400 });
    }

    // --- Download Media ---
    console.log(`Starting download for URL: ${youtubeUrl}, Type: ${analysisType}`);
    downloadResult = await downloadMedia(youtubeUrl, analysisType);
    const { filePath } = downloadResult;

    // --- Prepare for Gemini API ---
    console.log(`Preparing file for Gemini: ${filePath}`);
    const fileData = await fs.readFile(filePath);
    const fileStats = await fs.stat(filePath);

    // Basic check for empty file
     if (fileStats.size === 0) {
       throw new Error("Downloaded file is empty.");
     }
     
     // Enhanced size validation with better error messages
     if (fileStats.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        const sizeMB = (fileStats.size / (1024*1024)).toFixed(2);
        throw new Error(`Media file too large (${sizeMB}MB). Please try a shorter video or use audio-only analysis for long content. Maximum size: ${MAX_FILE_SIZE_MB}MB.`);
     }
     
     // Additional check specific to Gemini's API limit for more precise error
     if (fileStats.size > GEMINI_MAX_SIZE_BYTES) {
        const sizeMB = (fileStats.size / (1024*1024)).toFixed(2);
        throw new Error(`File exceeds Gemini API size limit (${sizeMB}MB > 300MB). Please try a shorter video or use audio-only analysis.`);
     }

    // Determine MIME type (basic guess based on extension)
    const mimeType = analysisType === 'video' ? 'video/mp4' : 'audio/mp3'; // Adjust if yt-dlp gives different formats

    // --- Call Gemini API ---
    console.log(`Calling Gemini API for file: ${filePath} (MIME: ${mimeType}, Size: ${(fileStats.size / (1024*1024)).toFixed(2)}MB)`);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" }); // Use the appropriate model

    const generationConfig = {
      temperature: 0.7, // Adjust creativity/determinism
      topK: 1,
      topP: 1,
      maxOutputTokens: 8192, // Max output tokens
    };

     const safetySettings = [
       { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
       { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
       { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
       { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
     ];

    const parts = [
      { text: getAnalysisPrompt() },
      {
        inlineData: {
          mimeType: mimeType,
          data: fileData.toString("base64"), // Send file data as base64
        },
      },
    ];

    const result = await model.generateContent({
       contents: [{ role: "user", parts }],
       generationConfig,
       safetySettings,
     });

    console.log("Gemini API response received.");

    if (!result.response) {
        console.error("Gemini API Error: No response object found.", result);
        throw new Error("Gemini API did not return a valid response object.");
    }

    const responseText = result.response.text(); // Use .text() method

    if (!responseText) {
        console.error("Gemini API Error: Response text is empty.", result.response);
        // Check for blocked content
        if (result.response.promptFeedback?.blockReason) {
             throw new Error(`Content blocked by Gemini: ${result.response.promptFeedback.blockReason}`);
        }
        throw new Error("Gemini API returned an empty response.");
    }

    console.log("Analysis successful.");

    // --- Return Success Response ---
    return NextResponse.json({ reportContent: responseText });

  } catch (error: unknown) {
    console.error("Error in /api/analyze:", error);
    // Return specific errors if possible
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during analysis.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    // --- Cleanup Temporary File ---
    if (downloadResult?.cleanup) {
      await downloadResult.cleanup();
    }
  }
}
