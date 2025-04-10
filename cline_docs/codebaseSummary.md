## Codebase Summary

### Overview
This project is a Next.js application designed to process media (likely YouTube videos based on `src/app/components/YoutubeInput.tsx` and `src/lib/youtubeApi.ts`). It appears to involve transcription, analysis, and synthesis, managed through a job queue system and interacting with a Supabase backend.

### Key Components and Their Interactions
*(Based on initial file structure analysis - requires deeper review)*

-   **`/src/app/`**: Core Next.js application structure.
    -   **`/pages`**: Frontend pages (`page.tsx` files like `/`, `/reports`, `/settings`, `/transcription`, `/prompt-testing`).
    -   **`/api`**: Backend API routes handling specific tasks:
        -   `analyze`, `analyze-transcription`: Likely involve AI processing of text.
        -   `synthesize`: Potentially text-to-speech or similar generation.
        -   `transcribe`: Handles audio/video transcription.
        -   `jobs`, `job-status`: Manage the background job queue.
        -   `reports`: API for accessing processed report data.
    -   **`/components`**: Reusable React components (e.g., `YoutubeInput.tsx`, `JobStatusIndicator.tsx`).
-   **`/src/lib/`**: Core logic and utilities.
    -   `supabaseClient.ts`, `database.types.ts`: Supabase integration.
    -   `jobQueue.ts`, `progressTracker.ts`, `progressTrackerServer.ts`: Background task management.
    -   `youtubeApi.ts`: Interaction with YouTube.
    -   `promptTesting.ts`: Utilities related to prompt testing page.
    -   `timeEstimates.ts`: Logic for estimating job durations.
-   **`/src/store/`**: State management (`store.ts`).
-   **`/data/`**: Likely stores persistent data, like generated reports (`/data/reports/`).
-   **`/public/`**: Static assets (images, icons).
-   **`/supabase/`**: Supabase specific configurations or migrations (if used).
-   **`/tmp_media/`**: Temporary storage for media files during processing.

### Data Flow
*(High-level inference - needs verification)*
1.  User inputs data (e.g., YouTube URL via `YoutubeInput`).
2.  Frontend calls an API route (e.g., `/api/jobs` or `/api/transcribe`).
3.  API route potentially downloads media (`/tmp_media/`), adds a task to the `jobQueue`.
4.  Background process picks up the job (transcribe, analyze, synthesize).
5.  Progress is tracked (`progressTracker`).
6.  Results (e.g., transcriptions, analysis reports) are stored (likely in Supabase, potentially referenced in `/data/reports/`).
7.  Frontend polls `job-status` and displays results/reports when ready.

### External Dependencies
- **Supabase:** Backend-as-a-Service (DB, Auth?).
- **YouTube API:** For fetching video data/captions.
- **AI Services:** OpenAI (`openai: ^4.91.1`), Google Generative AI (`@google/generative-ai: ^0.24.0`). *Requires env vars.*
- **UI Libraries:** Mantine (`@mantine/core: ^7.17.3`, `@mantine/hooks: ^7.17.3`, `@mantine/next: ^6.0.22` - *adapter version mismatch*), Radix UI (`@radix-ui/*`), Tailwind CSS (`tailwindcss: ^4`, `autoprefixer: ^10.4.21`, `postcss: ^8.5.3`).
- **State Management:** Zustand (`zustand: ^5.0.3`).
- **Utilities:** `uuid: ^11.1.0`, `react-markdown: ^10.1.0`, `next-themes: ^0.4.6`, `sonner: ^2.0.3`, `tailwind-merge: ^3.2.0`.

### Recent Significant Changes
*(None tracked yet)*

### User Feedback Integration
*(N/A at this stage)*

*(This document provides an initial overview and will be refined during the detailed review.)*
