/**
 * Extracts the YouTube video ID from different URL formats
 * Supports regular youtube.com URLs, youtu.be short URLs, and embed URLs
 * 
 * @param url The YouTube URL
 * @returns The video ID if found, null otherwise
 */
export function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;

  // Try multiple regex patterns to handle different URL formats
  
  // Standard youtube.com watch URLs
  // e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ or youtube.com/watch?v=dQw4w9WgXcQ&t=120
  let match = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([^&]+)/);
  if (match && match[1]) return match[1];
  
  // Short youtu.be URLs
  // e.g., https://youtu.be/dQw4w9WgXcQ or youtu.be/dQw4w9WgXcQ?t=120
  match = url.match(/(?:youtu\.be\/)([^?&]+)/);
  if (match && match[1]) return match[1];

  // Embed URLs
  // e.g., https://www.youtube.com/embed/dQw4w9WgXcQ
  match = url.match(/(?:youtube\.com\/embed\/)([^?&]+)/);
  if (match && match[1]) return match[1];
  
  // Youtube API URLs
  // e.g., https://www.googleapis.com/youtube/v3/videos?id=dQw4w9WgXcQ&part=snippet
  match = url.match(/(?:\/videos\?id=)([^&]+)/);
  if (match && match[1]) return match[1];

  return null;
}

/**
 * Formats a duration in seconds to a human readable format
 * 
 * @param durationSeconds Duration in seconds
 * @returns Formatted string (e.g., "1h 24m" or "5m 30s")
 */
export function formatDuration(durationSeconds: number): string {
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = Math.floor(durationSeconds % 60);
  
  let formattedDuration = '';
  
  if (hours > 0) {
    formattedDuration += `${hours}h `;
  }
  
  if (minutes > 0 || hours > 0) {
    formattedDuration += `${minutes}m `;
  }
  
  if (seconds > 0 && hours === 0) {
    formattedDuration += `${seconds}s`;
  }
  
  return formattedDuration.trim();
}

/**
 * Constructs the thumbnail URL for a YouTube video
 * 
 * @param videoId The YouTube video ID
 * @param quality The thumbnail quality (default, medium, high, standard, maxres)
 * @returns The URL to the thumbnail image
 */
export function getThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'standard' | 'maxres' = 'medium'): string {
  // YouTube thumbnail quality options:
  // default: 120x90
  // mqdefault: 320x180
  // hqdefault: 480x360
  // sddefault: 640x480
  // maxresdefault: 1280x720 or higher (if available)
  
  switch (quality) {
    case 'default':
      return `https://img.youtube.com/vi/${videoId}/default.jpg`;
    case 'medium':
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    case 'high':
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    case 'standard':
      return `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
    case 'maxres':
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    default:
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }
} 