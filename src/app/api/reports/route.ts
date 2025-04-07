import { NextResponse, type NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

// --- Configuration ---
const REPORTS_DIR = path.join(process.cwd(), 'data', 'reports');

// --- Helper Functions ---

// Function to ensure reports directory exists
async function ensureReportsDirExists() {
  try {
    await fs.access(REPORTS_DIR);
  } catch {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    console.log(`Created reports directory: ${REPORTS_DIR}`);
  }
}

// Interface for Report structure
interface Report {
  id: string;
  youtubeUrl: string;
  analysisType: 'video' | 'audio';
  timestamp: string;
  reportContent: string; // The Markdown content from Gemini
}

// --- API Route Handlers ---

// GET /api/reports - List all saved reports (metadata only)
export async function GET() {
  console.log("Received GET request to /api/reports");
  await ensureReportsDirExists();

  try {
    const files = await fs.readdir(REPORTS_DIR);
    const reportFiles = files.filter(file => file.endsWith('.json'));

    const reportsMetadata = await Promise.all(
      reportFiles.map(async (file) => {
        try {
          const filePath = path.join(REPORTS_DIR, file);
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const reportData: Report = JSON.parse(fileContent);
          // Return only metadata, not the full content for listing
          return {
            id: reportData.id,
            youtubeUrl: reportData.youtubeUrl,
            analysisType: reportData.analysisType,
            timestamp: reportData.timestamp,
            // Optionally add a title or snippet here if needed later
          };
        } catch (readError) {
          console.error(`Error reading or parsing report file ${file}:`, readError);
          return null; // Skip corrupted files
        }
      })
    );

    // Filter out any nulls from failed reads/parses
    const validReports = reportsMetadata.filter(report => report !== null);
    // Sort by timestamp descending (newest first)
    validReports.sort((a, b) => new Date(b!.timestamp).getTime() - new Date(a!.timestamp).getTime());


    return NextResponse.json(validReports);

  } catch (error: unknown) {
    console.error("Error listing reports:", error);
    return NextResponse.json({ error: "Failed to list reports." }, { status: 500 });
  }
}

// POST /api/reports - Save a new report
export async function POST(request: NextRequest) {
  console.log("Received POST request to /api/reports");
  await ensureReportsDirExists();

  try {
    const body = await request.json();
    const { youtubeUrl, analysisType, reportContent } = body;

    // --- Input Validation ---
    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid youtubeUrl' }, { status: 400 });
    }
    if (!analysisType || (analysisType !== 'video' && analysisType !== 'audio')) {
      return NextResponse.json({ error: 'Missing or invalid analysisType' }, { status: 400 });
    }
    if (!reportContent || typeof reportContent !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid reportContent' }, { status: 400 });
    }

    const newReport: Report = {
      id: uuidv4(), // Generate a unique ID
      youtubeUrl,
      analysisType,
      reportContent,
      timestamp: new Date().toISOString(),
    };

    const filePath = path.join(REPORTS_DIR, `${newReport.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(newReport, null, 2)); // Pretty print JSON

    console.log(`Report saved successfully: ${filePath}`);
    return NextResponse.json(newReport, { status: 201 }); // Return the created report

  } catch (error: unknown) {
    console.error("Error saving report:", error);
    return NextResponse.json({ error: "Failed to save report." }, { status: 500 });
  }
}

// DELETE /api/reports?id={reportId} - Delete a specific report
export async function DELETE(request: NextRequest) {
    console.log("Received DELETE request to /api/reports");
    await ensureReportsDirExists();

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');

    if (!reportId) {
        return NextResponse.json({ error: 'Missing report ID parameter' }, { status: 400 });
    }

    // Basic validation against path traversal
    if (reportId.includes('/') || reportId.includes('\\') || reportId.includes('..')) {
         return NextResponse.json({ error: 'Invalid report ID format' }, { status: 400 });
    }

    const filePath = path.join(REPORTS_DIR, `${reportId}.json`);

    try {
        await fs.access(filePath); // Check if file exists
        await fs.unlink(filePath); // Delete the file
        console.log(`Report deleted successfully: ${filePath}`);
        return NextResponse.json({ message: 'Report deleted successfully' }, { status: 200 });
    } catch (error: unknown) {
        // For Node.js filesystem errors that have a code property
        const nodeError = error as { code?: string };
        if (nodeError.code === 'ENOENT') {
            console.warn(`Attempted to delete non-existent report: ${reportId}`);
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }
        console.error(`Error deleting report ${reportId}:`, error);
        return NextResponse.json({ error: 'Failed to delete report.' }, { status: 500 });
    }
}
