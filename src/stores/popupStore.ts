import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import type { EventDraft, UIState, ToastMessage, AccountStatus, ParsedIntent, CalendarEvent } from '@/types';

// Custom storage adapter for chrome.storage.local (SYNCHRONOUS reads/writes)
const chromeStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const result = await chrome.storage.local.get(name);
      return result[name] || null;
    } catch (error) {
      console.error('Error reading from chrome.storage:', error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await chrome.storage.local.set({ [name]: value });
    } catch (error) {
      console.error('Error writing to chrome.storage:', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await chrome.storage.local.remove(name);
    } catch (error) {
      console.error('Error removing from chrome.storage:', error);
    }
  },
};

interface PopupStore {
  // UI State
  uiState: UIState;
  setUIState: (state: UIState) => void;

  // Input
  inputText: string;
  setInputText: (text: string) => void;
  cursorPosition: number;
  setCursorPosition: (position: number) => void;
  lastParsedText: string; // Track what text was last parsed to avoid double API calls
  setLastParsedText: (text: string) => void;

  // Parsed Intent (new)
  parsedIntent: ParsedIntent | null;
  setParsedIntent: (intent: ParsedIntent | null) => void;

  // Parsed Event (legacy, for create intent)
  eventDraft: EventDraft | null;
  setEventDraft: (draft: EventDraft | null) => void;
  parseConfidence: number;
  setParseConfidence: (confidence: number) => void;

  // Multiple events (for create_multiple intent)
  multipleEventDrafts: EventDraft[];
  setMultipleEventDrafts: (drafts: EventDraft[]) => void;
  currentEventIndex: number;
  setCurrentEventIndex: (index: number) => void;

  // Delete/Modify state
  matchedEvents: CalendarEvent[];
  setMatchedEvents: (events: CalendarEvent[]) => void;
  selectedEvent: CalendarEvent | null;
  setSelectedEvent: (event: CalendarEvent | null) => void;

  // View events state
  viewTimeframe: { timeframe: string; startISO: string; endISO: string } | null;
  setViewTimeframe: (timeframe: { timeframe: string; startISO: string; endISO: string } | null) => void;

  // Multiple commands state
  multipleCommands: ParsedIntent[] | null;
  setMultipleCommands: (commands: ParsedIntent[] | null) => void;

  // Targets
  targets: { google: boolean; outlook: boolean };
  setTargets: (targets: { google: boolean; outlook: boolean }) => void;
  toggleGoogle: () => void;
  toggleOutlook: () => void;
  
  // Toast
  toast: ToastMessage | null;
  showToast: (toast: ToastMessage) => void;
  hideToast: () => void;
  
  // Account Status
  accountStatus: AccountStatus;
  setAccountStatus: (status: AccountStatus) => void;
  
  // Reset
  reset: () => void;
}

export const usePopupStore = create<PopupStore>()(
  persist(
    (set) => ({
  // Initial state
  uiState: 'idle',
  inputText: '',
  cursorPosition: 0,
  lastParsedText: '',
  parsedIntent: null,
  eventDraft: null,
  parseConfidence: 0,
  multipleEventDrafts: [],
  currentEventIndex: 0,
  matchedEvents: [],
  selectedEvent: null,
  viewTimeframe: null,
  multipleCommands: null,
  targets: { google: true, outlook: true },
  toast: null,
  accountStatus: { google: false, outlook: false },

  // Actions (persist middleware handles persistence automatically)
  setUIState: (uiState) => set({ uiState }),

  setInputText: (inputText) => set({ inputText }),

  setCursorPosition: (cursorPosition) => set({ cursorPosition }),

  setLastParsedText: (lastParsedText) => set({ lastParsedText }),

  setParsedIntent: (parsedIntent) => set({ parsedIntent }),

  setEventDraft: (eventDraft) => set({ eventDraft }),

  setParseConfidence: (parseConfidence) => set({ parseConfidence }),

  setMultipleEventDrafts: (multipleEventDrafts) => set({ multipleEventDrafts }),

  setCurrentEventIndex: (currentEventIndex) => set({ currentEventIndex }),

  setMatchedEvents: (matchedEvents) => set({ matchedEvents }),

  setSelectedEvent: (selectedEvent) => set({ selectedEvent }),

  setViewTimeframe: (viewTimeframe) => set({ viewTimeframe }),

  setMultipleCommands: (multipleCommands) => set({ multipleCommands }),

  setTargets: (targets) => set({ targets }),

  toggleGoogle: () => set((state) => ({
    targets: { ...state.targets, google: !state.targets.google }
  })),

  toggleOutlook: () => set((state) => ({
    targets: { ...state.targets, outlook: !state.targets.outlook }
  })),
  
  showToast: (toast) => set({ toast }),
  
  hideToast: () => set({ toast: null }),
  
  setAccountStatus: (accountStatus) => set({ accountStatus }),

  reset: () => set({
    uiState: 'idle',
    inputText: '',
    lastParsedText: '',
    parsedIntent: null,
    eventDraft: null,
    parseConfidence: 0,
    multipleEventDrafts: [],
    currentEventIndex: 0,
    matchedEvents: [],
    selectedEvent: null,
    toast: null,
  }),
    }),
    {
      name: 'chronos-popup-storage',
      storage: createJSONStorage(() => chromeStorage),
      // Only persist these fields
      partialize: (state) => ({
        inputText: state.inputText,
        cursorPosition: state.cursorPosition,
        // Don't persist lastParsedText - it should reset each session
        uiState: state.uiState,
        eventDraft: state.eventDraft,
        parsedIntent: state.parsedIntent,
        parseConfidence: state.parseConfidence,
        multipleEventDrafts: state.multipleEventDrafts,
        currentEventIndex: state.currentEventIndex,
        matchedEvents: state.matchedEvents,
        selectedEvent: state.selectedEvent,
        targets: state.targets,
      }),
    }
  )
);
