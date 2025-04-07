import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import OpenAI from 'openai';

// --- Configuration ---
const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// --- API Client Initialization ---
let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  console.warn("Gemini API Key not found. API calls will fail.");
}

let openai: OpenAI | null = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
} else {
  console.warn("OpenAI API Key not found. GPT API calls will fail.");
}

// --- Helper Functions ---

// Get the transcription-focused analysis prompt
function getTranscriptionAnalysisPrompt(): string {
  return `
You are an expert AI assistant specialized in analyzing music production content. You will be provided with a TRANSCRIPT of a music production tutorial, podcast, or discussion.

Your task is to carefully analyze the transcribed content and generate a structured report containing the following sections. Focus solely on the music production content. Ignore unrelated segments like introductions, sponsor reads, or personal anecdotes unless they directly contain a production tip or technique.

## Concise Summary
Provide a brief overview of the main topics discussed in the content. (2-4 sentences)

## Key Production Tips
List specific, actionable tips mentioned for improving music production. Ensure each item listed is actionable and provides clear guidance a producer could implement. (Use bullet points)
*   Example Tip 1
*   Example Tip 2

## Techniques Discussed
Identify and describe any specific production techniques explained (e.g., sidechain compression setup, specific EQ methods, sound design approaches). Ensure each item listed is actionable and provides clear guidance a producer could implement. (Use bullet points and brief descriptions)
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

## Possible Visual Elements
Since this analysis is based solely on the transcript, note any moments where the speaker might be demonstrating something visually that is not fully captured in the transcript. (Use bullet points if applicable)
*   Possible visual demonstration 1
*   Possible visual demonstration 2

Please format the entire output using Markdown with clear level-2 headings (e.g., \`## Summary\`, \`## Key Production Tips\`) for each section. Focus on extracting practical and useful information for a music producer.
  `.trim();
}

// Function to analyze text with Gemini
async function analyzeWithGemini(transcriptionText: string, youtubeUrl: string | null = null): Promise<string> {
  if (!genAI) {
    throw new Error('Gemini API client not initialized. Check API key.');
  }

  console.log("Analyzing transcript with Gemini");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

  const generationConfig = {
    temperature: 0.7,
    topK: 1,
    topP: 1,
    maxOutputTokens: 8192,
  };

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];

  // Create the prompt
  const prompt = getTranscriptionAnalysisPrompt();
  let fullPrompt = prompt;
  
  // Add YouTube URL if provided
  if (youtubeUrl) {
    fullPrompt += `\n\nThe transcript is from this YouTube video: ${youtubeUrl}\n\n`;
  }
  
  // Add the transcript
  fullPrompt += `\n\nTRANSCRIPT TO ANALYZE:\n\n${transcriptionText}`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    generationConfig,
    safetySettings,
  });

  if (!result.response) {
    throw new Error("Gemini API did not return a valid response object.");
  }

  const responseText = result.response.text();

  if (!responseText) {
    if (result.response.promptFeedback?.blockReason) {
      throw new Error(`Content blocked by Gemini: ${result.response.promptFeedback.blockReason}`);
    }
    throw new Error("Gemini API returned an empty response.");
  }

  return responseText;
}

// Function to analyze text with GPT-4
async function analyzeWithGPT(transcriptionText: string, youtubeUrl: string | null = null): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Check API key.');
  }

  console.log("Analyzing transcript with GPT-4");
  
  // Create the prompt
  const prompt = getTranscriptionAnalysisPrompt();
  let fullPrompt = prompt;
  
  // Add YouTube URL if provided
  if (youtubeUrl) {
    fullPrompt += `\n\nThe transcript is from this YouTube video: ${youtubeUrl}\n\n`;
  }
  
  // Add the transcript
  fullPrompt += `\n\nTRANSCRIPT TO ANALYZE:\n\n${transcriptionText}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      { role: "system", content: "You are an expert music production analyst specializing in extracting techniques and advice from educational content." },
      { role: "user", content: fullPrompt }
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  if (!completion.choices[0]?.message?.content) {
    throw new Error("OpenAI API returned an empty response.");
  }

  return completion.choices[0].message.content;
}

// --- API Route Handler (POST) ---
export async function POST(request: NextRequest) {
  console.log("Received POST request to /api/analyze-transcription");

  try {
    const body = await request.json();
    const { transcriptionId, youtubeUrl, modelType } = body;

    // --- Input Validation ---
    if (!transcriptionId && !body.transcriptionText) {
      return NextResponse.json({ error: 'Missing transcription. Provide either transcriptionId or transcriptionText.' }, { status: 400 });
    }

    // Determine which model to use (default to Gemini)
    const model = modelType && modelType.toLowerCase() === 'gpt' ? 'gpt' : 'gemini';
    
    let transcriptionText: string;
    
    // If a direct transcript is provided, use it
    if (body.transcriptionText) {
      transcriptionText = body.transcriptionText;
      console.log("Using directly provided transcription text");
    } 
    // Otherwise, fetch from database using the ID
    else {
      console.log(`Fetching transcription with ID: ${transcriptionId}`);
      const { data: transcription, error: fetchError } = await supabase
        .from('transcriptions')
        .select('content, youtube_url')
        .eq('id', transcriptionId)
        .single();
      
      if (fetchError) {
        console.error("Supabase error fetching transcription:", fetchError);
        return NextResponse.json({ error: `Failed to fetch transcription: ${fetchError.message}` }, { status: 500 });
      }
      
      if (!transcription) {
        return NextResponse.json({ error: 'Transcription not found.' }, { status: 404 });
      }
      
      transcriptionText = transcription.content;
      
      // If YouTube URL wasn't provided in the request but is in the transcription record, use that
      if (!youtubeUrl && transcription.youtube_url && transcription.youtube_url !== 'direct_upload') {
        body.youtubeUrl = transcription.youtube_url;
      }
    }
    
    // Validate we have text to analyze
    if (!transcriptionText || transcriptionText.trim().length < 50) {
      return NextResponse.json({ 
        error: 'Transcription text is too short or empty. Cannot perform analysis.' 
      }, { status: 400 });
    }

    // --- Perform Analysis Based on Selected Model ---
    let analysisResult: string;
    
    if (model === 'gpt') {
      if (!openai) {
        return NextResponse.json({ error: 'OpenAI client not initialized. Check API key.' }, { status: 500 });
      }
      analysisResult = await analyzeWithGPT(transcriptionText, youtubeUrl);
    } else {
      if (!genAI) {
        return NextResponse.json({ error: 'Gemini API client not initialized. Check API key.' }, { status: 500 });
      }
      analysisResult = await analyzeWithGemini(transcriptionText, youtubeUrl);
    }

    // --- Create Report Record ---
    if (body.saveReport === true) {
      try {
        await supabase
          .from('reports')
          .insert({
            youtube_url: youtubeUrl || 'unknown',
            analysis_type: 'transcription',
            report_content: analysisResult,
            model_used: model,
            analysis_method: 'transcription'
          });
        console.log("Analysis saved to reports database.");
      } catch (saveError) {
        console.error("Error saving report:", saveError);
        // Continue even if saving fails - we'll still return the result to the user
      }
    }

    // --- Return Success Response ---
    return NextResponse.json({ 
      reportContent: analysisResult,
      modelUsed: model,
      analysisMethod: 'transcription'
    });

  } catch (error: unknown) {
    console.error("Error in /api/analyze-transcription:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during analysis.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 