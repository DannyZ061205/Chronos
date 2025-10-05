import * as chrono from 'chrono-node';
import { DateTime } from 'luxon';
import type { EventDraft, ParseResult } from '@/types';
import { parseLLMEvent, hasApiKey } from './llmParser';

const DURATION_REGEX = /(?:for\s+)?(?:(\d+(?:\.\d+)?)\s*h(?:our)?s?)?(?:\s*(\d+)\s*m(?:in)?(?:ute)?s?)?/i;
const DURATION_SHORT_REGEX = /(?:for\s+)?(\d+(?:\.\d+)?)\s*h(?:our)?s?/i;

/**
 * Extract duration from text (e.g., "for 1h30m", "1.5h", "90m")
 * Returns duration in minutes
 */
function extractDuration(text: string): number | null {
  // Try to match patterns like "1h30m", "1.5h", "90m", "for 1 hour 30 minutes"
  const match = text.match(DURATION_REGEX);
  
  if (match) {
    const hours = match[1] ? parseFloat(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    return hours * 60 + minutes;
  }
  
  // Try simple hour format
  const shortMatch = text.match(DURATION_SHORT_REGEX);
  if (shortMatch) {
    return parseFloat(shortMatch[1]) * 60;
  }
  
  // Try standalone minutes (e.g., "90m")
  const minutesMatch = text.match(/(\d+)\s*m(?:in)?(?:ute)?s?(?:\s|$)/i);
  if (minutesMatch) {
    return parseInt(minutesMatch[1], 10);
  }
  
  return null;
}

/**
 * Parse natural language input into an EventDraft
 * Uses LLM if available, falls back to chrono-node
 * Examples:
 *   "Lunch with Sara Friday 1pm for 45m"
 *   "Entrepreneurship tomorrow 5pm 1h30"
 *   "Team sync next Monday 2pm for 30 minutes"
 */
export async function parseEventCommand(
  text: string,
  defaultDurationMinutes: number = 60,
  timezone?: string
): Promise<ParseResult> {
  console.log('parseEventCommand - Starting parse for:', text);

  // Try LLM parser first if API key is available
  const hasLLM = await hasApiKey();
  console.log('parseEventCommand - Has API key?', hasLLM);

  if (hasLLM) {
    console.log('parseEventCommand - Attempting LLM parse...');
    const llmResult = await parseLLMEvent(text, defaultDurationMinutes, timezone);
    console.log('parseEventCommand - LLM result:', llmResult);

    if (llmResult.success) {
      console.log('parseEventCommand - Using LLM result with intent:', llmResult.intent?.intent);
      return llmResult;
    }

    // If LLM fails with quota error, return that error immediately (don't fall back)
    if (llmResult.error && llmResult.error.includes('Quota Exhausted')) {
      console.error('LLM quota exhausted, returning error to user');
      return llmResult;
    }

    // For other LLM failures, fall back to basic parser
    console.warn('LLM parsing failed, falling back to basic parser:', llmResult.error);
  } else {
    console.warn('parseEventCommand - No API key found, using basic parser');
  }

  // Fall back to basic chrono-node parser
  console.log('parseEventCommand - Using basic parser');
  return parseEventCommandBasic(text, defaultDurationMinutes, timezone);
}

/**
 * Basic parser using chrono-node (fallback)
 */
function parseEventCommandBasic(
  text: string,
  defaultDurationMinutes: number = 60,
  timezone?: string
): ParseResult {
  try {
    // Get user's timezone
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Extract duration first (and remove it from text for better date parsing)
    const durationMinutes = extractDuration(text) || defaultDurationMinutes;
    const textWithoutDuration = text.replace(DURATION_REGEX, '').replace(DURATION_SHORT_REGEX, '').trim();
    
    // Parse dates using chrono-node
    const parsed = chrono.parse(textWithoutDuration, new Date(), { forwardDate: true });
    
    if (parsed.length === 0) {
      return {
        success: false,
        error: 'Could not understand the date/time. Try: "tomorrow 2pm" or "Friday at 3pm"',
      };
    }
    
    // Use the first parsed result
    const result = parsed[0];
    const startDate = result.start.date();
    
    if (!startDate) {
      return {
        success: false,
        error: 'Could not determine event start time',
      };
    }
    
    // Convert to Luxon DateTime for timezone-aware calculations
    let startDateTime = DateTime.fromJSDate(startDate, { zone: tz });
    
    // If only date was parsed (no time), default to a reasonable time
    if (!result.start.get('hour')) {
      // Default to 9am if no time specified
      startDateTime = startDateTime.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    }
    
    // Calculate end time
    const endDateTime = startDateTime.plus({ minutes: durationMinutes });
    
    // Extract title (everything before the date/time)
    let title = text;
    if (result.index > 0) {
      title = text.substring(0, result.index).trim();
    }
    
    // If no clear title, try to extract from remaining text
    if (!title || title.length < 2) {
      // Remove date/time and duration from original text
      const dateText = result.text;
      title = text
        .replace(dateText, '')
        .replace(DURATION_REGEX, '')
        .replace(DURATION_SHORT_REGEX, '')
        .trim();
    }
    
    // Default title if still empty
    if (!title || title.length < 2) {
      title = 'Event';
    }
    
    // Calculate confidence based on how much we understood
    let confidence = 0.8;
    if (!result.start.get('hour')) {
      confidence -= 0.2; // Less confident if we had to default the time
    }
    if (title === 'Event') {
      confidence -= 0.3; // Less confident if we couldn't extract title
    }
    
    const draft: EventDraft = {
      title,
      startISO: startDateTime.toISO()!,
      endISO: endDateTime.toISO()!,
      tz,
    };
    
    return {
      success: true,
      draft,
      confidence,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}

/**
 * Format a DateTime for display
 */
export function formatDateTime(isoString: string, tz: string): string {
  const dt = DateTime.fromISO(isoString, { zone: tz });
  return dt.toLocaleString(DateTime.DATETIME_MED);
}

/**
 * Format date only
 */
export function formatDate(isoString: string, tz: string): string {
  const dt = DateTime.fromISO(isoString, { zone: tz });
  return dt.toLocaleString(DateTime.DATE_FULL);
}

/**
 * Format time only
 */
export function formatTime(isoString: string, tz: string): string {
  const dt = DateTime.fromISO(isoString, { zone: tz });
  return dt.toLocaleString(DateTime.TIME_SIMPLE);
}

/**
 * Get duration between two ISO strings in human-readable format
 */
export function getDurationString(startISO: string, endISO: string): string {
  const start = DateTime.fromISO(startISO);
  const end = DateTime.fromISO(endISO);
  const diff = end.diff(start, ['hours', 'minutes']);
  
  const hours = Math.floor(diff.hours);
  const minutes = Math.floor(diff.minutes);
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}
