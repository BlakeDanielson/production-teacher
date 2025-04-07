import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client

// --- Configuration ---
const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("ERROR: GOOGLE_GEMINI_API_KEY environment variable is not set.");
}

// --- Gemini Client Initialization ---
let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  console.warn("Gemini API Key not found. Synthesis API calls will fail.");
}

// --- Helper Function: Get Synthesis Prompt ---
function getSynthesisPrompt(): string {
  // Using the prompt defined during planning
  return `
You are an advanced AI assistant specializing in synthesizing knowledge from music production analyses. You have been provided with a collection of reports previously generated by analyzing various YouTube videos/podcasts on music production. These reports represent a knowledge base you have accumulated.

Your task is to act as a learning system. Review the entire collection of provided reports and perform the following:

## Recurring Themes & Core Principles
What are the most common tips, techniques, or pieces of advice that appear across multiple reports? List the top 5-7 core principles observed, synthesizing them concisely.

## Contrasting or Unique Perspectives
Did any reports offer advice or techniques that significantly contradict others or provide a particularly unique viewpoint compared to the rest of the knowledge base? Briefly describe these instances.

## Synthesized Insights & Connections
Based on the *combination* of information across all provided reports, can you formulate any *new*, higher-level insights, connections between topics, or recommendations for music producers that might not be explicitly stated in any single report? Aim for 2-3 novel points derived from the synthesis.

## Potential Knowledge Gaps or Further Exploration
Based on the analyzed content, what topics or techniques seem frequently mentioned but perhaps lack deep explanation across the reports, suggesting they might be valuable areas for a producer to study further? Or, are there any apparent gaps in the knowledge base represented by these reports?

Present your findings clearly using Markdown headings as shown. Focus on providing value beyond simply summarizing the individual reports. Treat the input as a knowledge base to learn from and generate meta-level understanding.
  `.trim();
}

// --- API Route Handler (POST) ---
export async function POST(request: NextRequest) {
  console.log("Received POST request to /api/synthesize");

  if (!genAI) {
    return NextResponse.json({ error: 'Gemini API client not initialized. Check API key.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { reportIds } = body;

    // --- Input Validation ---
    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid reportIds array' }, { status: 400 });
    }
    if (reportIds.length < 2) {
        return NextResponse.json({ error: 'At least two reports are required for synthesis' }, { status: 400 });
    }

    // --- Fetch Selected Reports from Supabase ---
    console.log(`Fetching reports for synthesis: ${reportIds.join(', ')}`);

    const { data: reportsData, error: fetchError } = await supabase
      .from('reports')
      .select('id, youtube_url, report_content') // Select necessary fields
      .in('id', reportIds); // Use .in() filter to get multiple reports by ID

    if (fetchError) {
      console.error("Supabase error fetching reports for synthesis:", fetchError);
      throw fetchError;
    }

    if (!reportsData || reportsData.length === 0) {
        return NextResponse.json({ error: `No valid reports found for the provided IDs.` }, { status: 404 });
    }

    // Validate if we found enough reports (in case some IDs were invalid)
    if (reportsData.length < 2) {
         return NextResponse.json({ error: `Only ${reportsData.length} valid reports found, need at least 2 for synthesis.` }, { status: 400 });
    }

    // --- Combine Report Content ---
    let combinedContent = "";
    for (const report of reportsData) {
      // Use DB column names (snake_case)
      combinedContent += `--- Report Start (ID: ${report.id}, URL: ${report.youtube_url}) ---\n\n`;
      combinedContent += report.report_content;
      combinedContent += `\n\n--- Report End (ID: ${report.id}) ---\n\n`;
    }

    // --- Call Gemini API for Synthesis ---
    console.log(`Calling Gemini API for synthesis with combined content from ${reportsData.length} reports.`);
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

    // Construct the prompt with the combined report data
    const synthesisPrompt = getSynthesisPrompt();
    const fullPrompt = `${synthesisPrompt}\n\n## Combined Report Data:\n\n${combinedContent}`;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig,
        safetySettings,
    });

    console.log("Gemini API synthesis response received.");

     if (!result.response) {
         console.error("Gemini API Synthesis Error: No response object found.", result);
         throw new Error("Gemini API did not return a valid response object for synthesis.");
     }

     const responseText = result.response.text();

     if (!responseText) {
         console.error("Gemini API Synthesis Error: Response text is empty.", result.response);
         if (result.response.promptFeedback?.blockReason) {
              throw new Error(`Synthesis content blocked by Gemini: ${result.response.promptFeedback.blockReason}`);
         }
         throw new Error("Gemini API returned an empty synthesis response.");
     }

    console.log("Synthesis successful.");

    // --- Return Success Response ---
    return NextResponse.json({ synthesisResult: responseText });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in /api/synthesize:", errorMessage);
    if (error && typeof error === 'object' && 'code' in error) {
      console.error("Supabase error code:", (error as { code: string }).code);
    }
    return NextResponse.json({ error: "An unexpected error occurred during synthesis." }, { status: 500 });
  }
}
