import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Import the Supabase client

// Interface for Report Metadata (matching GET response needs)
// We derive the full type from Supabase schema now
interface ReportMetadata {
  id: string;
  youtube_url: string; // Match DB column names
  analysis_type: 'video' | 'audio'; // Match DB column names
  created_at: string; // Match DB column names
  // user_id?: string; // Optional: if you added user_id
}


// --- API Route Handlers ---

// GET /api/reports - List all saved reports (metadata only)
export async function GET() {
  console.log("Received GET request to /api/reports");

  try {
    // Fetch only necessary columns for listing, order by creation time
    const { data, error } = await supabase
      .from('reports')
      .select('id, youtube_url, analysis_type, created_at') // Select specific columns
      .order('created_at', { ascending: false }); // Order by timestamp descending

    if (error) {
      console.error("Supabase error listing reports:", error);
      throw error; // Throw error to be caught below
    }

    // Map data to match the expected frontend structure if needed,
    // otherwise, ensure frontend expects snake_case from DB
    const reportsMetadata: ReportMetadata[] = data || [];

    // If your frontend absolutely expects the old 'timestamp' field:
    // const reportsMetadata = (data || []).map(report => ({
    //   id: report.id,
    //   youtubeUrl: report.youtube_url, // Map snake_case to camelCase
    //   analysisType: report.analysis_type,
    //   timestamp: report.created_at // Map created_at to timestamp
    // }));


    return NextResponse.json(reportsMetadata);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error listing reports:", errorMessage);
    // Check if it's a Supabase specific error for more details
    if (error && typeof error === 'object' && 'code' in error) {
         console.error("Supabase error code:", (error as { code: string }).code);
    }
    return NextResponse.json({ error: "Failed to list reports." }, { status: 500 });
  }
}

// POST /api/reports - Save a new report
export async function POST(request: NextRequest) {
  console.log("Received POST request to /api/reports");

  try {
    const body = await request.json();
    // Destructure matching frontend names first
    const { youtubeUrl, analysisType, reportContent } = body;

    // --- Input Validation -- -
    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid youtubeUrl' }, { status: 400 });
    }
    if (!analysisType || (analysisType !== 'video' && analysisType !== 'audio')) {
      return NextResponse.json({ error: 'Missing or invalid analysisType' }, { status: 400 });
    }
    if (!reportContent || typeof reportContent !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid reportContent' }, { status: 400 });
    }
    // Optional: Add validation for user_id if implementing user accounts

    // Prepare data for Supabase (match column names)
    const reportDataToInsert = {
        youtube_url: youtubeUrl,
        analysis_type: analysisType,
        report_content: reportContent,
        // user_id: userId // Add if implementing user accounts
    };

    const { data, error } = await supabase
      .from('reports')
      .insert(reportDataToInsert)
      .select() // Select the inserted data to return it
      .single(); // Expecting a single row to be inserted and returned

    if (error) {
      console.error("Supabase error saving report:", error);
      throw error;
    }

    if (!data) {
        throw new Error("Supabase insert operation did not return data.");
    }

    console.log(`Report saved successfully with ID: ${data.id}`);
    // Return the created report data (or just a success message)
    // The returned 'data' will have DB column names (snake_case)
    return NextResponse.json(data, { status: 201 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error saving report:", errorMessage);
     if (error && typeof error === 'object' && 'code' in error) {
          console.error("Supabase error code:", (error as { code: string }).code);
     }
    return NextResponse.json({ error: "Failed to save report." }, { status: 500 });
  }
}

// DELETE /api/reports?id={reportId} - Delete a specific report
export async function DELETE(request: NextRequest) {
    console.log("Received DELETE request to /api/reports");

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');

    if (!reportId) {
        return NextResponse.json({ error: 'Missing report ID parameter' }, { status: 400 });
    }

    // UUID validation can be added here if needed
    if (typeof reportId !== 'string' /* || !isValidUUID(reportId) */) {
         return NextResponse.json({ error: 'Invalid report ID format' }, { status: 400 });
    }

    try {
        const { error } = await supabase
            .from('reports')
            .delete()
            .eq('id', reportId); // Match the 'id' column with the provided reportId

        if (error) {
            console.error(`Supabase error deleting report ${reportId}:`, error);
            // Handle specific errors, e.g., foreign key constraints if applicable
            throw error;
        }

        // Note: Supabase delete doesn't error if the row doesn't exist by default.
        // If you need to confirm deletion happened, you might check the 'count' property
        // in the response if available/needed, or perform a select first (less efficient).

        console.log(`Report deleted successfully (or did not exist): ${reportId}`);
        return NextResponse.json({ message: 'Report deleted successfully' }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error deleting report ${reportId}:`, errorMessage);
        if (error && typeof error === 'object' && 'code' in error) {
             console.error("Supabase error code:", (error as { code: string }).code);
        }
        // Check for common Supabase error codes if needed
        // const pgError = error as { code?: string };
        // if (pgError.code === '23503') { // Foreign key violation
        //     return NextResponse.json({ error: 'Cannot delete report due to related data.' }, { status: 409 });
        // }
        return NextResponse.json({ error: 'Failed to delete report.' }, { status: 500 });
    }
}
