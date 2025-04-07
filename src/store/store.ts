import { create } from 'zustand';
import { notifications, NotificationData } from '@mantine/notifications'; // For feedback in actions and import NotificationData type
import { ReportMetadata, AnalysisModel } from '@/types'; // Use shared types
import React from 'react'; // Import React

// Helper to check if code is running in browser environment
const isBrowser = typeof window !== 'undefined';

// --- Settings State --- 
interface SettingsState {
  googleApiKey: string | null;
  openaiApiKey: string | null;
  defaultAnalysisModel: AnalysisModel;
  isSettingsLoaded: boolean;
  setGoogleApiKey: (key: string) => void;
  setOpenaiApiKey: (key: string) => void;
  setDefaultAnalysisModel: (model: AnalysisModel) => void;
  loadSettings: () => void;
  saveSettings: () => Promise<void>; // Make save async
}

// --- Reports State --- 
interface ReportsState {
  savedReports: ReportMetadata[];
  isLoadingReports: boolean;
  fetchError: string | null;
  fetchReports: () => Promise<void>; // Make fetch async
  addReport: (reportData: { youtube_url: string; analysis_type: string; report_content: string; }) => Promise<void>; // Action to add a new report
  deleteReport: (id: string) => Promise<void>; // Make delete async
}

// --- Combined Store --- 
interface AppState extends SettingsState, ReportsState {}

// Create a persist middleware for settings
const createStore = () => {
  return create<AppState>((set, get) => ({
    // --- Settings Initial State & Actions --- 
    googleApiKey: null,
    openaiApiKey: null,
    defaultAnalysisModel: 'gemini',
    isSettingsLoaded: false,

    setGoogleApiKey: (key) => set({ googleApiKey: key }),
    setOpenaiApiKey: (key) => set({ openaiApiKey: key }),
    setDefaultAnalysisModel: (model) => set({ defaultAnalysisModel: model }),

    loadSettings: () => {
      if (!isBrowser) {
        // Skip localStorage access on server-side
        set({ isSettingsLoaded: true });
        return;
      }
      
      try {
        const storedGoogleKey = localStorage.getItem('googleApiKey');
        const storedOpenaiKey = localStorage.getItem('openaiApiKey');
        const storedModel = localStorage.getItem('defaultAnalysisModel') as AnalysisModel;
        
        console.log("Loading settings from localStorage:", { 
          hasGoogleKey: !!storedGoogleKey, 
          hasOpenAIKey: !!storedOpenaiKey,
          model: storedModel || 'gemini (default)'
        });
        
        set({
          googleApiKey: storedGoogleKey,
          openaiApiKey: storedOpenaiKey,
          defaultAnalysisModel: storedModel || 'gemini', // Default if not found
          isSettingsLoaded: true,
        });
      } catch (error) {
        console.error("Error loading settings from localStorage:", error);
        set({ isSettingsLoaded: true }); // Mark as loaded even if error
      }
    },

    saveSettings: async () => {
      if (!isBrowser) {
        // Cannot save settings on server-side
        return;
      }
      
      const { googleApiKey, openaiApiKey, defaultAnalysisModel } = get();
      if (!googleApiKey || !openaiApiKey) {
        const notificationConfig: NotificationData = {
          title: 'Missing Keys', 
          message: 'Please provide both Google Gemini and OpenAI API keys.', 
          color: 'orange', 
        };
        notifications.show(notificationConfig);
        return;
      }
        
      try {
        localStorage.setItem('googleApiKey', googleApiKey);
        localStorage.setItem('openaiApiKey', openaiApiKey);
        localStorage.setItem('defaultAnalysisModel', defaultAnalysisModel);
        
        console.log("Settings saved successfully to localStorage");
        
        const notificationConfig: NotificationData = {
          title: 'Settings Saved', 
          message: 'Settings saved in local storage.', 
          color: 'green',
        };
        notifications.show(notificationConfig);
      } catch (error) {
        console.error("Error saving settings to localStorage:", error);
        const notificationConfig: NotificationData = {
          title: 'Error', 
          message: 'Could not save settings.', 
          color: 'red',
        };
        notifications.show(notificationConfig);
        throw error;
      }
    },

    // --- Reports Initial State & Actions --- 
    savedReports: [],
    isLoadingReports: false,
    fetchError: null,

    fetchReports: async () => {
      set({ isLoadingReports: true, fetchError: null });
      try {
        const response = await fetch('/api/reports');
        if (!response.ok) {
          const data = await response.json().catch(() => ({})); // Try to get error details
          throw new Error(data.error || `Failed to fetch reports: ${response.statusText}`);
        }
        const data: ReportMetadata[] = await response.json();
        set({ savedReports: data, isLoadingReports: false });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Could not load saved reports.";
        console.error("Error fetching reports:", err);
        set({ isLoadingReports: false, fetchError: errorMsg });
        const notificationConfig: NotificationData = { 
            title: 'Error Loading Reports', 
            message: errorMsg, 
            color: 'red', 
        };
        notifications.show(notificationConfig);
      }
    },

    addReport: async (reportData) => {
       // We might not need this if saving always happens via the API and fetchReports is called after
       // However, it could be useful for optimistic updates.
       // For now, let's assume saving happens via API and we just refetch.
       console.log("addReport action called (currently does nothing but refetch)");
       // Potentially trigger a refetch after a save action elsewhere
       // get().fetchReports(); 
     },

    deleteReport: async (id) => {
       // Optional: Optimistic update - remove locally first
       // set((state) => ({ 
       //   savedReports: state.savedReports.filter((r) => r.id !== id), 
       // }));

      try {
        const response = await fetch(`/api/reports?id=${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to delete report');
        }
        notifications.show({ title: 'Report Deleted', message: `Report ${id} successfully deleted.`, color: 'green' });
        // Refresh the list after successful deletion
        get().fetchReports(); 
      } catch (err) {
         const errorMsg = err instanceof Error ? err.message : "Could not delete the report.";
        console.error(`Error deleting report ${id}:`, err);
        const notificationConfig: NotificationData = { 
            title: 'Delete Failed', 
            message: errorMsg, 
            color: 'red', 
        };
        notifications.show(notificationConfig);
        // Optional: Revert optimistic update if it failed
        // get().fetchReports(); // Refetch to get the correct state
      }
    },
  }));
};

// Create and export the store
export const useAppStore = createStore();

// Initialize settings on load (outside the hook)
// Only call loadSettings if in browser environment
if (isBrowser) {
  console.log("Browser environment detected - loading settings");
  // Load settings with a slight delay to ensure proper hydration
  setTimeout(() => {
    useAppStore.getState().loadSettings();
  }, 0);
} else {
  console.log("Server environment detected - skipping localStorage access");
} 