import { createClient } from '@supabase/supabase-js';
// Remove the import for Database types
// import type { Database } from './database.types';

// Define a basic Database type interface directly here
export type Database = {
  public: {
    Tables: {
      reports: {
        Row: {
          id: string
          created_at: string
          youtube_url: string
          analysis_type: string
          report_content: string
          user_id?: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          youtube_url: string
          analysis_type: string
          report_content: string
          user_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          youtube_url?: string
          analysis_type?: string
          report_content?: string
          user_id?: string | null
        }
      }
    }
  }
}

// Ensure environment variables are loaded (important for server-side usage)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Supabase URL not found. Make sure NEXT_PUBLIC_SUPABASE_URL is set in your environment variables.");
}

if (!supabaseAnonKey) {
  throw new Error("Supabase anon key not found. Make sure NEXT_PUBLIC_SUPABASE_ANON_KEY is set in your environment variables.");
}

// Create and export the Supabase client
// Use the directly defined Database types
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Optional: If you need server-side admin privileges later, you might create a separate
// client using the service_role key, but store that key securely server-side only.
// Example (DO NOT USE ANON KEY HERE for service role):
// import { createClient as createServerClient } from '@supabase/supabase-js';
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Must be set securely
// export const supabaseAdmin = createServerClient<Database>(supabaseUrl, supabaseServiceKey); 