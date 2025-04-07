import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import OpenAI from 'openai';
import { exec } from 'child_process';
import fs from 'fs/promises';
import * as fsStandard from 'fs'; // Add standard fs for createReadStream
import path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);

// --- Configuration ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEMP_DIR = path.join(process.cwd(), 'tmp_media'); // Directory for temporary files
const TRANSCRIPTION_MAX_SIZE_MB = 25; // OpenAI's Whisper API has a 25MB limit
const MAX_DURATION_SECONDS = 3600; // Optional max duration to process (1 hour)

// Initialize OpenAI client
let openai: OpenAI | null = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
} else {
  console.warn("OpenAI API Key not found. Transcription API calls will fail.");
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
    const fileStats = await fs.stat(outputPath);
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
          await fs.unlink(outputPath);
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
  console.log("Received POST request to /api/transcribe");
  
  if (!openai) {
    return NextResponse.json({ error: 'OpenAI client not initialized. Check API key.' }, { status: 500 });
  }
  
  let audioResult: { audioPath: string; durationSeconds: number; cleanup: () => Promise<void> } | null = null;
  
  try {
    const formData = await request.formData();
    
    // Check if a file was directly uploaded
    const audioFile = formData.get('audioFile') as File | null;
    const videoPath = formData.get('videoPath') as string || null;
    const youtubeUrl = formData.get('youtubeUrl') as string || null;
    
    // Get transcription options
    const audioFormat = (formData.get('format') as 'mp3' | 'wav' | 'm4a') || 'mp3';
    const audioQuality = (formData.get('quality') as 'low' | 'medium' | 'high') || 'medium';
    const language = formData.get('language') as string || null; // Optional language hint
    const prompt = formData.get('prompt') as string || null; // Optional transcription prompt
    
    // Validate input - we need at least one source
    if (!audioFile && !videoPath && !youtubeUrl) {
      return NextResponse.json({ 
        error: 'Missing audio source. Provide either audioFile, videoPath, or youtubeUrl.' 
      }, { status: 400 });
    }
    
    let sourceAudioPath: string;
    
    // Handle different input sources
    if (audioFile) {
      // Direct file upload - save to temp directory
      await ensureTempDirExists();
      const fileName = `uploaded_${Date.now()}.${audioFile.name.split('.').pop()}`;
      sourceAudioPath = path.join(TEMP_DIR, fileName);
      
      const buffer = Buffer.from(await audioFile.arrayBuffer());
      await fs.writeFile(sourceAudioPath, buffer);
      console.log(`Saved uploaded audio file to ${sourceAudioPath}`);
      
      // For uploaded files, we'll process them directly (but might need conversion)
      audioResult = await extractAudio(sourceAudioPath, { format: audioFormat, quality: audioQuality });
    } 
    else if (videoPath) {
      // Local video path (likely from a previous download)
      sourceAudioPath = videoPath;
      audioResult = await extractAudio(sourceAudioPath, { format: audioFormat, quality: audioQuality });
    }
    else if (youtubeUrl) {
      // We'll need to download this first, then extract audio
      // This would use the existing downloadMedia function, but for now we'll return an error
      return NextResponse.json({ 
        error: 'YouTube URL processing not implemented yet. Please use a local video path.' 
      }, { status: 501 });
    }
    else {
      // This shouldn't happen due to the validation above, but just in case
      return NextResponse.json({ error: 'No valid audio source provided.' }, { status: 400 });
    }
    
    if (!audioResult) {
      throw new Error("Failed to extract or process audio.");
    }
    
    // Check if the duration exceeds our limit
    if (audioResult.durationSeconds > MAX_DURATION_SECONDS) {
      throw new Error(`Audio duration (${Math.floor(audioResult.durationSeconds / 60)} minutes) exceeds the maximum limit of ${MAX_DURATION_SECONDS / 60} minutes.`);
    }
    
    // Create a transcription record in the database with 'processing' status
    const { data: transcriptionRecord, error: insertError } = await supabase
      .from('transcriptions')
      .insert({
        youtube_url: youtubeUrl || 'direct_upload', // Store the URL if provided
        transcription_service: 'whisper',
        content: '', // Will update after processing
        duration_seconds: Math.round(audioResult.durationSeconds),
        word_count: 0, // Will update after processing
        status: 'processing'
      })
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to create transcription record: ${insertError.message}`);
    }
    
    // Transcribe using OpenAI's Whisper API
    console.log(`Transcribing audio file: ${audioResult.audioPath}`);
    const audioStream = fsStandard.createReadStream(audioResult.audioPath);
    
    const transcriptionOptions: any = {
      file: audioStream,
      model: "whisper-1", // The Whisper model
      response_format: "json",
    };
    
    // Add optional parameters if provided
    if (language) transcriptionOptions.language = language;
    if (prompt) transcriptionOptions.prompt = prompt;
    
    const transcription = await openai.audio.transcriptions.create(transcriptionOptions);
    
    // Count words in the transcript
    const wordCount = transcription.text.split(/\s+/).filter(Boolean).length;
    
    // Update the database record with the completed transcription
    const { error: updateError } = await supabase
      .from('transcriptions')
      .update({
        content: transcription.text,
        word_count: wordCount,
        status: 'complete'
      })
      .eq('id', transcriptionRecord.id);
    
    if (updateError) {
      throw new Error(`Failed to update transcription record: ${updateError.message}`);
    }
    
    console.log("Transcription completed successfully.");
    
    // Return success response with the transcription
    return NextResponse.json({ 
      id: transcriptionRecord.id,
      text: transcription.text,
      duration_seconds: Math.round(audioResult.durationSeconds),
      word_count: wordCount,
      success: true
    });
    
  } catch (error: unknown) {
    console.error("Error in /api/transcribe:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during transcription.";
    
    // If we created a transcription record, update it to failed status
    if (errorMessage.includes("transcription record")) {
      // Extract the ID from the error if possible and update the status
      try {
        const match = /transcription record:\s*(.+)/.exec(errorMessage);
        const id = match ? match[1] : null;
        if (id) {
          await supabase
            .from('transcriptions')
            .update({ status: 'failed', content: `Error: ${errorMessage}` })
            .eq('id', id);
        }
      } catch (updateError) {
        console.error("Failed to update transcription status to failed:", updateError);
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
    
  } finally {
    // Cleanup temporary audio file
    if (audioResult?.cleanup) {
      await audioResult.cleanup();
    }
  }
} 