// Core types for Chronos extension

export type Tz = string; // IANA timezone identifier

export interface EventDraft {
  title: string;
  startISO: string; // RFC3339 with TZ offset
  endISO: string;   // RFC3339 with TZ offset
  tz: Tz;
  description?: string; // Event description/notes
  recurrence?: string; // RRULE string for recurring events
  needsTimeConfirmation?: boolean; // True if user didn't provide specific time
}

// Command intent types
export type CommandIntent = 'create' | 'create_multiple' | 'delete' | 'modify';

export interface CreateIntent {
  intent: 'create';
  draft: EventDraft;
  confidence: number;
}

export interface CreateMultipleIntent {
  intent: 'create_multiple';
  drafts: EventDraft[];
  confidence: number;
}

export interface DeleteIntent {
  intent: 'delete';
  searchQuery: string;
  confidence: number;
}

export interface ModifyIntent {
  intent: 'modify';
  searchQuery: string;
  changes: Record<string, string>;
  confidence: number;
}

export type ParsedIntent = CreateIntent | CreateMultipleIntent | DeleteIntent | ModifyIntent;

export interface ParseResult {
  success: boolean;
  intent?: ParsedIntent;
  // Legacy support
  draft?: EventDraft;
  confidence?: number;
  error?: string;
}

export interface Defaults {
  durationMinutes: number;
  tzOverride?: Tz;
  telemetryOptIn: boolean;
}

export interface Token {
  accessToken: string;
  expiresAt: number; // timestamp
  refreshToken?: string;
}

export interface Tokens {
  google?: Token;
  outlook?: Token;
}

// Message contracts between popup and service worker
export interface CreateEventRequest {
  type: 'CREATE_EVENT';
  payload: {
    title: string;
    startISO: string;
    endISO: string;
    tz: string;
    description?: string;
    recurrence?: string;
    targets: { google: boolean; outlook: boolean };
    clientRequestId: string;
  };
}

export interface ListEventsRequest {
  type: 'LIST_EVENTS';
  payload: {
    maxResults?: number;
    sources: { google: boolean; outlook: boolean };
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  startISO: string;
  endISO: string;
  description?: string;
  source: 'google' | 'outlook';
  recurrence?: string; // RRULE string if this is a recurring event
  location?: string;
}

export interface ListEventsResponse {
  ok: boolean;
  events: CalendarEvent[];
  error?: string;
}

export type RecurrenceScope = 'this' | 'following' | 'all';

export interface DeleteEventRequest {
  type: 'DELETE_EVENT';
  payload: {
    eventId: string;
    source: 'google' | 'outlook';
    recurringScope?: RecurrenceScope; // How to handle recurring events
  };
}

export interface DeleteEventResponse {
  ok: boolean;
  error?: string;
}

export interface RestoreEventRequest {
  type: 'RESTORE_EVENT';
  payload: {
    eventId: string;
    source: 'google' | 'outlook';
  };
}

export interface RestoreEventResponse {
  ok: boolean;
  error?: string;
}

export interface ModifyEventRequest {
  type: 'MODIFY_EVENT';
  payload: {
    eventId: string;
    source: 'google' | 'outlook';
    updates: {
      title?: string;
      startISO?: string;
      endISO?: string;
      description?: string;
      location?: string;
    };
    recurringScope?: RecurrenceScope; // How to handle recurring events
  };
}

export interface ModifyEventResponse {
  ok: boolean;
  error?: string;
}

export interface CalendarResult {
  ok: boolean;
  eventId?: string;
  code?: string;
  msg?: string;
}

export interface CreateEventResponse {
  ok: boolean;
  results: {
    google?: CalendarResult;
    outlook?: CalendarResult;
  };
}

// UI State
export type UIState =
  | 'idle'
  | 'parsing'
  | 'preview'
  | 'editing'
  | 'submitting'
  | 'success'
  | 'partial'
  | 'error'
  | 'delete_confirm'
  | 'modify_form'
  | 'time_confirmation'; // Ask user for specific time when not provided

export interface ToastMessage {
  type: 'success' | 'error' | 'info';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Storage schema
export interface StorageSchema {
  version: number;
  defaults: Defaults;
  lastFailedPayload?: {
    payload: CreateEventRequest['payload'];
    timestamp: number;
    error: string;
  };
}

// Account status
export interface AccountStatus {
  google: boolean;
  outlook: boolean;
}
