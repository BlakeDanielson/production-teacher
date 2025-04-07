import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import OpenAI from 'openai';
import { exec } from 'child_process';
import fs from 'fs'; // Standard fs for sync methods like createReadStream
import fsPromises from 'fs/promises'; // For async fs operations
import path from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import multiparty from 'multiparty';
import os from 'os';

const execPromise = promisify(exec);

// --- Configuration ---
const TEMP_DIR = path.join(process.cwd(), 'tmp_media'); // Directory for temporary files
const TRANSCRIPTION_MAX_SIZE_MB = 25; // OpenAI's Whisper API has a 25MB limit
const MAX_DURATION_SECONDS = 3600; // Optional max duration to process (1 hour)

// Helper to parse multipart form data
const parseForm = (req: NextRequest): Promise<{ fields: Record<string, string[]>, files: Record<string, multiparty.File[]> }> => {
  return new Promise((resolve, reject) => {
    const form = new multiparty.Form();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => { headers[key] = value; });

    const readableStream = req.body as ReadableStream<any>;
    const nodeReadable = new Readable({
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
    
    // Correctly type callback parameters allowing undefined
    form.parse({ ...nodeReadable, headers: headers } as any, (err: Error | null, fields: Record<string, string[] | undefined>, files: Record<string, multiparty.File[] | undefined>) => {
      if (err) return reject(err);
      // Filter out undefined before resolving if necessary, or handle downstream
      // For simplicity, we assume fields/files exist and cast (add checks if needed)
      resolve({ fields: fields as Record<string, string[]>, files: files as Record<string, multiparty.File[]> }); 
    });
  });
};

// --- Helper Functions ---

// Function to ensure temporary directory exists
async function ensureTempDirExists() {
  try {
    await fsPromises.access(TEMP_DIR, fs.constants.F_OK);
  } catch {
    // Directory does not exist, create it
    await fsPromises.mkdir(TEMP_DIR, { recursive: true });
    console.log(`Created temporary directory: ${TEMP_DIR}`);
  }
}

// Enhanced function to extract high-quality audio from video
async function extractAudio(videoPath: string, options: {
  format?: 'mp3' | 'wav' | 'm4a',
  quality?: 'low' | 'medium' | 'high',
  startTime?: number,
  endTime?: number
} = {}): Promise<{ 
  audioPath: string, 
  durationSeconds: number,
  cleanup: () => Promise<void> 
}> {
  await ensureTempDirExists();
  
  // Set defaults
  const format = options.format || 'mp3';
  const uniqueId = Date.now();
  const outputPath = path.join(TEMP_DIR, `audio_${uniqueId}.${format}`);
  
  // Build ffmpeg command
  let ffmpegCommand = `ffmpeg -i "${videoPath}" -vn`; // Extract audio, no video
  
  // Add quality settings
  if (options.quality === 'high') {
    // High quality settings
    if (format === 'mp3') {
      ffmpegCommand += ' -c:a libmp3lame -b:a 320k -ar 48000';
    } else if (format === 'wav') {
      ffmpegCommand += ' -c:a pcm_s16le -ar 44100';
    } else { // m4a
      ffmpegCommand += ' -c:a aac -b:a 256k -ar 48000';
    }
  } else if (options.quality === 'medium') {
    // Medium quality settings
    if (format === 'mp3') {
      ffmpegCommand += ' -c:a libmp3lame -b:a 192k -ar 44100';
    } else if (format === 'wav') {
      ffmpegCommand += ' -c:a pcm_s16le -ar 22050';
    } else { // m4a
      ffmpegCommand += ' -c:a aac -b:a 160k -ar 44100';
    }
  } else {
    // Low quality settings (smaller file size)
    if (format === 'mp3') {
      ffmpegCommand += ' -c:a libmp3lame -b:a 128k -ar 22050';
    } else if (format === 'wav') {
      ffmpegCommand += ' -c:a pcm_s16le -ar 16000';
    } else { // m4a
      ffmpegCommand += ' -c:a aac -b:a 96k -ar 22050';
    }
  }
  
  // Add time range if specified
  if (options.startTime !== undefined) {
    ffmpegCommand += ` -ss ${options.startTime}`;
  }
  if (options.endTime !== undefined) {
    ffmpegCommand += ` -to ${options.endTime}`;
  }
  
  // Add output path
  ffmpegCommand += ` "${outputPath}"`;
  
  console.log(`Executing ffmpeg command: ${ffmpegCommand}`);
  
  try {
    const { stdout, stderr } = await execPromise(ffmpegCommand, { timeout: 300000 }); // 5 min timeout
    console.log('ffmpeg stdout:', stdout);
    if (stderr) {
      console.warn('ffmpeg stderr:', stderr); // ffmpeg outputs to stderr even for info
    }
    
    // Get duration of the audio file using ffprobe
    const durationCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`;
    const { stdout: durationOutput } = await execPromise(durationCommand);
    const durationSeconds = parseFloat(durationOutput.trim());
    
    // Check file size
    const fileStats = await fsPromises.stat(outputPath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    console.log(`Generated audio file: ${outputPath}, Size: ${fileSizeMB.toFixed(2)}MB, Duration: ${durationSeconds.toFixed(2)}s`);
    
    // Check if file exceeds the OpenAI Whisper API limit
    if (fileSizeMB > TRANSCRIPTION_MAX_SIZE_MB) {
      throw new Error(`Audio file size (${fileSizeMB.toFixed(2)}MB) exceeds the limit for transcription (${TRANSCRIPTION_MAX_SIZE_MB}MB).`);
    }
    
    return {
      audioPath: outputPath,
      durationSeconds,
      cleanup: async () => {
        try {
          await fsPromises.unlink(outputPath);
          console.log(`Cleaned up temporary audio file: ${outputPath}`);
        } catch (cleanupError) {
          console.error(`Error cleaning up file ${outputPath}:`, cleanupError);
        }
      }
    };
  } catch (error: unknown) {
    console.error('Error during audio extraction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown ffmpeg error';
    throw new Error(`Failed to extract audio: ${errorMessage}`);
  }
}

// --- API Route Handler (POST) ---
export async function POST(request: NextRequest) {
  try {
    const { fields, files } = await parseForm(request);

    const audioFileArray = files.audioFile;
    const qualityArray = fields.quality;
    const formatArray = fields.format;
    const openaiApiKeyArray = fields.openaiApiKey;

    // Validate required fields/files more robustly
    if (!audioFileArray || audioFileArray.length === 0) {
      return NextResponse.json({ error: 'No audio file uploaded.' }, { status: 400 });
    }
    const audioFile = audioFileArray[0];
    
    if (!openaiApiKeyArray || openaiApiKeyArray.length === 0) {
        return NextResponse.json({ error: 'Missing OpenAI API Key.' }, { status: 400 });
    }
    const openaiApiKey = openaiApiKeyArray[0];
    
    // Optional fields
    const quality = qualityArray?.[0];
    const format = formatArray?.[0]; 

    console.log("Received audio file:", audioFile.originalFilename);
    console.log("Quality setting:", quality);
    console.log("Format setting:", format);

    // --- Initialize OpenAI Client --- 
    const openai = new OpenAI({ apiKey: openaiApiKey }); 

    // --- Process with Whisper --- 
    console.log(`Sending ${audioFile.originalFilename} to Whisper API...`);

    // Use the path directly from the multiparty file object
    const fileStream = fs.createReadStream(audioFile.path);
    
    const transcription = await openai.audio.transcriptions.create({
      file: fileStream, 
      model: "whisper-1",
    });

    console.log("Whisper API response received.");

    const transcriptText = transcription.text;

    // --- Save to Supabase --- 
    console.log("Saving transcription to database...");
    const { data: dbData, error: dbError } = await supabase
      .from('transcriptions') 
      .insert({
        filename: audioFile.originalFilename,
        content: transcriptText,
        model_used: 'whisper-1',
      })
      .select()
      .single(); 

    if (dbError) {
      console.error("Supabase insert error:", dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log("Transcription saved successfully, ID:", dbData.id);

    return NextResponse.json({ 
        message: 'Transcription successful', 
        transcriptionId: dbData.id,
        text: transcriptText 
    });

  } catch (error: unknown) {
    console.error("Error in /api/transcribe:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } 
} 