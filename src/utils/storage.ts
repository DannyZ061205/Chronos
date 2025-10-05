import type { Defaults, StorageSchema } from '@/types';

/**
 * Generate a deterministic client request ID for idempotency
 * Based on title + start + end + tz
 */
export async function generateClientRequestId(
  title: string,
  startISO: string,
  endISO: string,
  tz: string
): Promise<string> {
  const data = `${title}|${startISO}|${endISO}|${tz}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: Defaults = {
  durationMinutes: 60,
  tzOverride: undefined,
  telemetryOptIn: false,
};

/**
 * Get user defaults from storage
 */
export async function getDefaults(): Promise<Defaults> {
  const result = await chrome.storage.sync.get('defaults');
  return result.defaults || DEFAULT_SETTINGS;
}

/**
 * Save user defaults to storage
 */
export async function saveDefaults(defaults: Defaults): Promise<void> {
  await chrome.storage.sync.set({ defaults });
}

/**
 * Get storage schema with versioning
 */
export async function getStorage(): Promise<StorageSchema> {
  const result = await chrome.storage.sync.get(['version', 'defaults']);
  return {
    version: result.version || 1,
    defaults: result.defaults || DEFAULT_SETTINGS,
  };
}

/**
 * Check if an event with this ID was recently created (for duplicate prevention)
 */
export async function isDuplicate(clientRequestId: string): Promise<boolean> {
  const result = await chrome.storage.local.get(`event_${clientRequestId}`);
  return !!result[`event_${clientRequestId}`];
}

/**
 * Mark an event as created (for duplicate prevention, 24h TTL)
 */
export async function markAsCreated(clientRequestId: string): Promise<void> {
  const key = `event_${clientRequestId}`;
  const timestamp = Date.now();
  await chrome.storage.local.set({ [key]: timestamp });
  
  // Clean up old entries (older than 24h)
  const allKeys = await chrome.storage.local.get(null);
  const now = Date.now();
  const keysToRemove: string[] = [];
  
  for (const [k, v] of Object.entries(allKeys)) {
    if (k.startsWith('event_') && typeof v === 'number') {
      const age = now - v;
      if (age > 24 * 60 * 60 * 1000) { // 24 hours
        keysToRemove.push(k);
      }
    }
  }
  
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}

/**
 * Get timezone from user settings or browser
 */
export function getTimezone(tzOverride?: string): string {
  if (tzOverride) {
    return tzOverride;
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Recent event for history display
 */
export interface RecentEvent {
  title: string;
  startISO: string;
  endISO: string;
  tz: string;
  description?: string;
  createdAt: number;
}

/**
 * Save a recent event to history
 */
export async function saveRecentEvent(event: Omit<RecentEvent, 'createdAt'>): Promise<void> {
  const recentEvents = await getRecentEvents();

  const newEvent: RecentEvent = {
    ...event,
    createdAt: Date.now(),
  };

  // Add to beginning of array
  recentEvents.unshift(newEvent);

  // Keep only last 5
  const trimmed = recentEvents.slice(0, 5);

  await chrome.storage.local.set({ recentEvents: trimmed });
}

/**
 * Get recent events (last 5)
 */
export async function getRecentEvents(): Promise<RecentEvent[]> {
  const result = await chrome.storage.local.get('recentEvents');
  return result.recentEvents || [];
}
