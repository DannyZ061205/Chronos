import { create } from 'zustand';
import { CalendarEvent } from '@/types';

// Action types that can be undone/redone
export type ActionType = 'create' | 'delete' | 'modify';

// Individual action record with calendar source
export interface ActionRecord {
  id: string; // Unique action ID
  type: ActionType;
  timestamp: number;

  // For create actions: store the created event details to delete it on undo
  createdEvent?: {
    eventId: string;
    source: 'google' | 'outlook';
    event: CalendarEvent;
  }[];

  // For delete actions: store the deleted event details to recreate it on undo
  deletedEvent?: {
    eventId: string;
    source: 'google' | 'outlook';
    event: CalendarEvent;
  }[];

  // For modify actions: store before and after states
  modifiedEvent?: {
    eventId: string;
    source: 'google' | 'outlook';
    before: CalendarEvent;
    after: CalendarEvent;
  }[];
}

interface ActionHistoryStore {
  // Action history stacks
  undoStack: ActionRecord[];
  redoStack: ActionRecord[];

  // Maximum history size (prevent memory issues)
  maxHistorySize: number;

  // Persistence status
  isLoaded: boolean;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;

  // Add action to history
  addAction: (action: Omit<ActionRecord, 'id' | 'timestamp'>) => void;

  // Undo last action
  undo: () => Promise<{ success: boolean; action?: ActionRecord; error?: string }>;

  // Redo last undone action
  redo: () => Promise<{ success: boolean; action?: ActionRecord; error?: string }>;

  // Check if undo/redo available
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Clear history
  clearHistory: () => void;

  // Get history for debugging
  getHistory: () => { undoStack: ActionRecord[]; redoStack: ActionRecord[] };
}

const STORAGE_KEY = 'chronos_action_history';

export const useActionHistoryStore = create<ActionHistoryStore>((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxHistorySize: 50, // Keep last 50 actions
  isLoaded: false,

  loadFromStorage: async () => {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      const stored = result[STORAGE_KEY];

      if (stored && stored.undoStack && stored.redoStack) {
        set({
          undoStack: stored.undoStack,
          redoStack: stored.redoStack,
          isLoaded: true,
        });
        console.log('Action history loaded from storage:', {
          undoCount: stored.undoStack.length,
          redoCount: stored.redoStack.length,
        });
      } else {
        set({ isLoaded: true });
      }
    } catch (error) {
      console.error('Failed to load action history from storage:', error);
      set({ isLoaded: true });
    }
  },

  saveToStorage: async () => {
    try {
      const { undoStack, redoStack } = get();
      await chrome.storage.local.set({
        [STORAGE_KEY]: { undoStack, redoStack },
      });
      console.log('Action history saved to storage');
    } catch (error) {
      console.error('Failed to save action history to storage:', error);
    }
  },

  addAction: (action) => {
    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    const newAction: ActionRecord = {
      id,
      timestamp,
      ...action,
    };

    set((state) => {
      const newUndoStack = [...state.undoStack, newAction];

      // Trim if exceeds max size
      if (newUndoStack.length > state.maxHistorySize) {
        newUndoStack.shift();
      }

      return {
        undoStack: newUndoStack,
        redoStack: [], // Clear redo stack when new action is added
      };
    });

    console.log('Action added to history:', newAction);

    // Save to storage after adding action
    get().saveToStorage();
  },

  undo: async () => {
    const { undoStack } = get();

    if (undoStack.length === 0) {
      return { success: false, error: 'Nothing to undo' };
    }

    const actionToUndo = undoStack[undoStack.length - 1];
    console.log('Undoing action:', actionToUndo);

    try {
      // Perform the reverse operation based on action type
      if (actionToUndo.type === 'create' && actionToUndo.createdEvent) {
        // Undo create = delete the created events
        const deletePromises = actionToUndo.createdEvent.map(({ eventId, source }) =>
          chrome.runtime.sendMessage({
            type: 'DELETE_EVENT',
            payload: { eventId, source },
          })
        );

        const results = await Promise.all(deletePromises);
        const failedDeletes = results.filter(r => !r.ok);

        if (failedDeletes.length > 0) {
          throw new Error(`Failed to undo create: ${failedDeletes.length} deletions failed`);
        }

      } else if (actionToUndo.type === 'delete' && actionToUndo.deletedEvent) {
        // Undo delete = restore the cancelled events (preserves original event IDs)
        console.log('[UNDO] Restoring deleted events:', actionToUndo.deletedEvent);

        const restorePromises = actionToUndo.deletedEvent.map(async ({ eventId, source }) => {
          console.log(`[UNDO] Restoring event ${eventId} from ${source}`);
          const response = await chrome.runtime.sendMessage({
            type: 'RESTORE_EVENT',
            payload: {
              eventId,
              source,
            },
          });
          console.log(`[UNDO] Restore response for ${eventId}:`, response);
          return response;
        });

        const results = await Promise.all(restorePromises);
        const failedRestores = results.filter(r => r && !r.ok);

        console.log('[UNDO] All restore results:', results);

        if (failedRestores.length > 0) {
          throw new Error(`Failed to undo delete: ${failedRestores.length} restores failed`);
        }

      } else if (actionToUndo.type === 'modify' && actionToUndo.modifiedEvent) {
        // Undo modify = restore to before state
        const modifyPromises = actionToUndo.modifiedEvent.map(({ eventId, source, before }) => {
          // Determine if this is a recurring event
          const isRecurring = before.recurrence !== undefined && before.recurrence !== null;

          return chrome.runtime.sendMessage({
            type: 'MODIFY_EVENT',
            payload: {
              eventId,
              source,
              updates: {
                title: before.title,
                startISO: before.startISO,
                endISO: before.endISO,
                description: before.description,
              },
              recurringScope: isRecurring ? 'all' : undefined,
            },
          });
        });

        const results = await Promise.all(modifyPromises);
        const failedModifies = results.filter(r => !r.ok);

        if (failedModifies.length > 0) {
          throw new Error(`Failed to undo modify: ${failedModifies.length} modifications failed`);
        }
      }

      // Move action from undo stack to redo stack
      set((state) => ({
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, actionToUndo],
      }));

      // Save to storage after undo
      await get().saveToStorage();

      return { success: true, action: actionToUndo };

    } catch (error) {
      console.error('Undo failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Undo failed',
      };
    }
  },

  redo: async () => {
    const { redoStack } = get();

    if (redoStack.length === 0) {
      return { success: false, error: 'Nothing to redo' };
    }

    const actionToRedo = redoStack[redoStack.length - 1];
    console.log('Redoing action:', actionToRedo);

    try {
      // Re-perform the original operation
      if (actionToRedo.type === 'create' && actionToRedo.createdEvent) {
        // Redo create = recreate the events with all original properties
        const createPromises = actionToRedo.createdEvent.map(({ event, source }) =>
          chrome.runtime.sendMessage({
            type: 'CREATE_EVENT',
            payload: {
              title: event.title,
              startISO: event.startISO,
              endISO: event.endISO,
              tz: 'UTC',
              description: event.description || '',
              recurrence: event.recurrence,
              targets: { google: source === 'google', outlook: source === 'outlook' },
              clientRequestId: `redo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            },
          })
        );

        const results = await Promise.all(createPromises);
        const failedCreates = results.filter(r => !r.ok);

        if (failedCreates.length > 0) {
          throw new Error(`Failed to redo create: ${failedCreates.length} creations failed`);
        }

      } else if (actionToRedo.type === 'delete' && actionToRedo.deletedEvent) {
        // Redo delete = cancel the events again (soft delete)
        const deletePromises = actionToRedo.deletedEvent.map(({ eventId, source }) =>
          chrome.runtime.sendMessage({
            type: 'DELETE_EVENT',
            payload: { eventId, source, recurringScope: 'all' },
          })
        );

        const results = await Promise.all(deletePromises);
        const failedDeletes = results.filter(r => !r.ok);

        if (failedDeletes.length > 0) {
          throw new Error(`Failed to redo delete: ${failedDeletes.length} deletions failed`);
        }

      } else if (actionToRedo.type === 'modify' && actionToRedo.modifiedEvent) {
        // Redo modify = apply the after state again
        const modifyPromises = actionToRedo.modifiedEvent.map(({ eventId, source, after }) => {
          // Determine if this is a recurring event
          const isRecurring = after.recurrence !== undefined && after.recurrence !== null;

          return chrome.runtime.sendMessage({
            type: 'MODIFY_EVENT',
            payload: {
              eventId,
              source,
              updates: {
                title: after.title,
                startISO: after.startISO,
                endISO: after.endISO,
                description: after.description,
              },
              recurringScope: isRecurring ? 'all' : undefined,
            },
          });
        });

        const results = await Promise.all(modifyPromises);
        const failedModifies = results.filter(r => !r.ok);

        if (failedModifies.length > 0) {
          throw new Error(`Failed to redo modify: ${failedModifies.length} modifications failed`);
        }
      }

      // Move action from redo stack back to undo stack
      set((state) => ({
        undoStack: [...state.undoStack, actionToRedo],
        redoStack: state.redoStack.slice(0, -1),
      }));

      // Save to storage after redo
      await get().saveToStorage();

      return { success: true, action: actionToRedo };

    } catch (error) {
      console.error('Redo failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Redo failed',
      };
    }
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  clearHistory: () => {
    set({ undoStack: [], redoStack: [] });
    console.log('Action history cleared');
    get().saveToStorage();
  },

  getHistory: () => {
    const { undoStack, redoStack } = get();
    return { undoStack, redoStack };
  },
}));
