import { NextResponse, type NextRequest } from 'next/server';
// Removed unused supabase import
// import OpenAI from 'openai'; // OpenAI client will be used by the worker
// Removed: import { exec } from 'child_process';
// Removed unused fs import
import fsPromises from 'fs/promises'; // For async fs operations
// Removed unused path import
// Removed unused promisify import
import { Readable } from 'stream';
import multiparty from 'multiparty';
// Removed unused os import
import { createJob } from '@/lib/jobQueue'; // Import createJob

// Removed: const execPromise = promisify(exec);

// --- Configuration ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Get OpenAI key from environment
// Removed unused TEMP_DIR constant
// Removed unused TRANSCRIPTION_MAX_SIZE_MB constant
// Removed unused MAX_DURATION_SECONDS constant

// Helper to parse multipart form data
const parseForm = (req: NextRequest): Promise<{ fields: Record<string, string[]>, files: Record<string, multiparty.File[]> }> => {
  return new Promise((resolve, reject) => {
    const form = new multiparty.Form();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => { headers[key] = value; });

    // Ensure Content-Type header is present for multiparty
    if (!headers['content-type']) {
        return reject(new Error('Missing Content-Type header for multipart form data'));
    }

    const readableStream = req.body as ReadableStream<Uint8Array>; // Replaced any with Uint8Array
    // Cast nodeReadable to any to attach headers, acknowledging potential type mismatch.
    // This is needed for compatibility with multiparty which expects Node streams.
    const nodeReadable: any = new Readable({
      async read() {
        const reader = readableStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              this.push(null); // Signal end of stream
              break;
            }
            this.push(Buffer.from(value)); // Push chunk
          }
        } catch (err) {
          this.destroy(err as Error); // Propagate error
        }
      }
    });

    // Add headers property to the stream object for multiparty
    nodeReadable.headers = headers;

    // Pass the adapted stream directly to form.parse
    form.parse(nodeReadable, (err: Error | null, fields: Record<string, string[] | undefined>, files: Record<string, multiparty.File[] | undefined>) => {
      if (err) return reject(err);
      // Filter out undefined before resolving if necessary, or handle downstream
      // For simplicity, we assume fields/files exist and cast (add checks if needed)
      resolve({ fields: fields as Record<string, string[]>, files: files as Record<string, multiparty.File[]> });
    });
  });
};

// --- Helper Functions ---

// Removed unused ensureTempDirExists function

// Enhanced function to extract high-quality audio from video - REMOVED (unused and relies on ffmpeg)
// async function extractAudio(...) { ... }

// --- API Route Handler (POST) ---
export async function POST(request: NextRequest) {
  try {
    const { fields, files } = await parseForm(request);

    // Check for API Key availability early
    if (!OPENAI_API_KEY) {
        console.error("CRITICAL: OPENAI_API_KEY is not set on the server.");
        return NextResponse.json({ error: "Server configuration error: Missing API key." }, { status: 500 });
    }

    // const { fields, files } = await parseForm(request); // REMOVED DUPLICATE

    const audioFileArray = files.audioFile;
    const qualityArray = fields.quality;
    const formatArray = fields.format;
    // const openaiApiKeyArray = fields.openaiApiKey; // REMOVED

    // Validate required fields/files more robustly
    if (!audioFileArray || audioFileArray.length === 0) {
      return NextResponse.json({ error: 'No audio file uploaded.' }, { status: 400 });
    }
    const audioFile = audioFileArray[0];
    
    // REMOVED API Key validation from form data
    
    // Optional fields
    const quality = qualityArray?.[0];
    const format = formatArray?.[0]; 

    console.log("Received audio file:", audioFile.originalFilename);
    console.log("Quality setting:", quality); // Keep for logging, might be passed to worker
    console.log("Format setting:", format); // Keep for logging, might be passed to worker

    // --- TODO: Upload audioFile.path to Persistent Storage (e.g., Supabase Storage) ---
    // This step is crucial for the worker to access the file.
    // Example conceptual logic (replace with actual implementation):
    // const storagePath = `uploads/${Date.now()}_${audioFile.originalFilename}`;
    // const { error: uploadError } = await supabase.storage
    //   .from('transcription-uploads') // Replace with your bucket name
    //   .upload(storagePath, fs.createReadStream(audioFile.path), {
    //     contentType: audioFile.headers['content-type'] || 'application/octet-stream',
    //     upsert: false,
    //   });
    // if (uploadError) {
    //   console.error("Error uploading file to storage:", uploadError);
    //   // Attempt to clean up local temp file even if upload fails
    //   try { await fsPromises.unlink(audioFile.path); } catch (_) {}
    //   throw new Error(`Failed to upload audio file: ${uploadError.message}`);
    // }
    // console.log(`File uploaded to storage at: ${storagePath}`);
    // --- End TODO ---

    // For now, simulate a storage path
    const storagePath = `simulated/path/to/${audioFile.originalFilename}`;
    console.warn("Using simulated storage path:", storagePath); // Add warning

    // --- Create Transcription Job ---
    try {
        const jobMetadata = {
            storagePath: storagePath, // Path to the file in persistent storage
            originalFilename: audioFile.originalFilename,
            contentType: audioFile.headers['content-type'],
            // Pass other relevant info if needed by worker (e.g., quality, format)
        };
        const newJob = await createJob('transcription', jobMetadata);
        console.log(`Created transcription job with ID: ${newJob.id}`);

        // --- Cleanup Local Temp File ---
        // Important: Clean up the temporary file created by multiparty AFTER successful job creation
        try {
            await fsPromises.unlink(audioFile.path);
            console.log(`Cleaned up local temporary file: ${audioFile.path}`);
        } catch (cleanupError) {
            // Log error but don't fail the request, job is already created
            console.error(`Error cleaning up local temporary file ${audioFile.path}:`, cleanupError);
        }

        // Return the job ID to the client
        return NextResponse.json(newJob, { status: 202 }); // 202 Accepted

    } catch (jobError) {
        console.error("Error creating transcription job:", jobError);
        // Attempt cleanup if job creation fails after potential upload
        // try { await fsPromises.unlink(audioFile.path); } catch (_) {}
        return NextResponse.json({ error: "Failed to create transcription job." }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error("Error in /api/transcribe:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } 
}
