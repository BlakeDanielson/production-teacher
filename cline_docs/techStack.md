## Technology Stack & Architecture

### Frontend Framework
- **Next.js:** `15.2.4` - React framework (using React 19). *Note: Bleeding edge version.*
- **React:** `^19.0.0` - UI library. *Note: Bleeding edge version.*
- **Tailwind CSS:** `^4` - Utility-first CSS framework. *Note: Requires compatible PostCSS setup (v8 used). Check `postcss.config.js` vs `postcss.config.mjs`.*
- **UI Components:** Mantine (`^7.17.3` core, `@mantine/next` `^6.0.22` - *version mismatch needs check*), Radix UI primitives.

### Backend / API
- **Next.js API Routes:** Used for backend logic within the Next.js application.
- **External APIs/Services:** Supabase (`^2.49.4`), OpenAI (`^4.91.1`), Google Generative AI (`^0.24.0`), YouTube API (inferred from `lib/youtubeApi.ts`). *Note: Require environment variables.*

### State Management
- **Zustand:** `^5.0.3` (Inferred from `package.json` and `src/store/store.ts`).

### Database
- **Supabase:** `^2.49.4` - Backend-as-a-Service platform (DB, Auth?). *Requires env vars.*

### Job Queue / Background Tasks
- **(Potential System):** (Inferred from `src/lib/jobQueue.ts`) - System for managing asynchronous tasks like transcription or analysis.

### Key Libraries/Dependencies
- `uuid`: `^11.1.0` - Unique ID generation.
- `react-markdown`: `^10.1.0` - Markdown rendering.
- `next-themes`: `^0.4.6` - Theme switching.
- `sonner`: `^2.0.3` - Toast notifications.
- `tailwind-merge`: `^3.2.0` - Merging Tailwind classes.

### Architecture Decisions
- Monorepo structure with frontend and API routes within the same Next.js project.
- Serverless functions via Next.js API routes for backend logic.
- Likely utilizes external services for core functionalities (database, AI tasks - OpenAI, Google AI).
- Potential compatibility issues due to use of very recent versions (Next.js 15, React 19, Tailwind 4) and Mantine adapter version mismatch.

*(This document will be updated as more information is gathered during the review.)*
