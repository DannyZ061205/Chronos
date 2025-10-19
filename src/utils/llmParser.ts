import { DateTime } from 'luxon';
import type { EventDraft, ParseResult } from '@/types';

/**
 * LLM-powered event parser using OpenAI API
 * Parses natural language into structured event data
 */

// NOTE: For production, store API key securely using Chrome storage
// Users should add their own OpenAI API key in the extension settings
const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';

/**
 * Get OpenAI API key from Chrome storage
 * Users must configure this in extension settings
 */
async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(['openaiApiKey']);
  return result.openaiApiKey || null;
}

/**
 * Save OpenAI API key to storage (deprecated - now using fixed key)
 */
export async function saveApiKey(_apiKey: string): Promise<void> {
  // No-op - using fixed API key now
  console.log('API key is now fixed and does not need to be saved');
}

/**
 * Parse event using LLM
 */
export async function parseLLMEvent(
  text: string,
  defaultDurationMinutes: number = 60,
  timezone?: string
): Promise<ParseResult> {
  try {
    const apiKey = await getApiKey();

    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = DateTime.now().setZone(tz);

    const systemPrompt = `You are a calendar event assistant. Detect user intent (create/delete/modify events) and extract relevant details.

TODAY IS: ${now.toFormat('EEEE, MMMM d, yyyy')} (${now.toFormat('EEEE')} is the current day of the week)
Current exact time: ${now.toISO()}
Timezone: ${tz}
Default duration: ${defaultDurationMinutes} minutes

IMPORTANT: When interpreting relative day references:
- "today" = ${now.toFormat('EEEE, MMMM d, yyyy')}
- "tomorrow" = ${now.plus({ days: 1 }).toFormat('EEEE, MMMM d, yyyy')}
- "Tuesday" (or any day name) = the NEXT occurrence of that day from today
- If today is ${now.toFormat('EEEE')}, then "Tuesday" means ${now.plus({ days: (2 - now.weekday + 7) % 7 || 7 }).toFormat('MMMM d, yyyy')}

INTENT DETECTION:
- CREATE: "add", "create", "schedule", "book", event descriptions without keywords
- DELETE: "delete", "remove", "cancel", "clear"
- MODIFY: "change", "move", "update", "reschedule", "edit"

MULTIPLE EVENTS:
- If the input contains MULTIPLE distinct events with different times/dates, extract ALL of them
- Each event should be a separate object in an "events" array
- Common in emails, announcements, or lists of events

RULES FOR EVENT CREATION:
1. Title: Extract ONLY the event name (e.g., "Go to gym", "ChatGPT EDU 101 Training - In-Person")
2. Time Detection: If the user does NOT provide a specific time (like "3pm", "at 10:00", "noon"), set "needsTimeConfirmation": true
   - Examples that NEED time: "go to gym tomorrow", "meeting on Friday", "dinner next week"
   - Examples that DON'T need time: "gym at 6am", "meeting Friday 3pm", "dinner next week at 7pm"
   - When needsTimeConfirmation is true, use current time as placeholder but flag it for confirmation
3. Description: Create BRIEF bullet-point style reminders of KEY details only
   - Extract: Things to bring, locations (Zoom links, room numbers), topics to discuss, important notes
   - Format: Short phrases like "Bring: X, Y" or "Venue: Zoom link" or "Location: Lecture Hall 1"
   - EXCLUDE: All timing/scheduling words ("everyday", "starting tomorrow", "at 6am", etc.)
   - Keep it SHORT - think "quick glance reminders", not full sentences
4. Recurrence: Support ADVANCED recurrence patterns:
   - Simple: "daily"/"everyday" → "DAILY", "weekly" → "WEEKLY", "monthly" → "MONTHLY", "yearly" → "YEARLY"
   - Weekends: "weekends"/"weekend" → "WEEKLY;BYDAY=SA,SU"
   - Weekdays: "weekdays"/"weekday" → "WEEKLY;BYDAY=MO,TU,WE,TH,FR"
   - Every N weeks: "every 2 weeks" → "WEEKLY;INTERVAL=2"
   - Every N days: "every 3 days" → "DAILY;INTERVAL=3"
   - Specific days: "every Monday and Wednesday" → "WEEKLY;BYDAY=MO,WE"
   - Day codes: MO=Monday, TU=Tuesday, WE=Wednesday, TH=Thursday, FR=Friday, SA=Saturday, SU=Sunday
   - IMPORTANT: When using BYDAY (like weekends/weekdays/specific days), startDateTime MUST be on one of those days!
     * For weekends (SA,SU): Pick the next Saturday or Sunday
     * For weekdays (MO-FR): Pick the next weekday
     * For specific days (e.g., MO,WE): Pick the next occurrence of one of those days
4. If there's a dash (-), text after it usually goes to description

Return JSON based on intent:

FOR SINGLE CREATE:
{
  "intent": "create",
  "title": "event name only",
  "startDateTime": "ISO datetime",
  "durationMinutes": number,
  "description": "brief key details only",
  "recurrencePattern": "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "WEEKLY;BYDAY=SA,SU" | "WEEKLY;BYDAY=MO,TU,WE,TH,FR" | "WEEKLY;INTERVAL=2" | "DAILY;INTERVAL=3" | null,
  "needsTimeConfirmation": true | false,
  "confidence": number
}

FOR MULTIPLE CREATE:
{
  "intent": "create_multiple",
  "events": [
    {
      "title": "event name",
      "startDateTime": "ISO datetime",
      "durationMinutes": number,
      "description": "brief key details",
      "recurrencePattern": null
    },
    // ... more events
  ],
  "confidence": number
}

FOR DELETE:
{
  "intent": "delete",
  "searchQuery": "event description to search for (e.g., 'gym', 'repeating gym event')",
  "confidence": number
}

FOR MODIFY:
{
  "intent": "modify",
  "searchQuery": "event description to search for",
  "changes": {"field": "value"}, // e.g., {"time": "3pm"} or {"date": "tomorrow"}
  "confidence": number
}

Examples:

SINGLE CREATE - Simple recurrence WITH time:
Input: "go to gym everyday starting from tomorrow at 6am"
Output: {"intent": "create", "title": "Go to gym", "startDateTime": "2025-10-05T06:00:00.000+04:00", "durationMinutes": 60, "description": "", "recurrencePattern": "DAILY", "needsTimeConfirmation": false, "confidence": 0.95}

SINGLE CREATE - WITHOUT specific time (needs confirmation):
Input: "go to gym tomorrow"
Output: {"intent": "create", "title": "Go to gym", "startDateTime": "2025-10-05T${now.toFormat('HH:mm:ss')}", "durationMinutes": 60, "description": "", "recurrencePattern": null, "needsTimeConfirmation": true, "confidence": 0.95}

SINGLE CREATE - Weekends:
Input: "go to gym 6am during weekends"
Output: {"intent": "create", "title": "Go to gym", "startDateTime": "2025-10-05T06:00:00.000+04:00", "durationMinutes": 60, "description": "", "recurrencePattern": "WEEKLY;BYDAY=SA,SU", "confidence": 0.95}

SINGLE CREATE - Weekdays:
Input: "standup meeting 9am every weekday"
Output: {"intent": "create", "title": "Standup meeting", "startDateTime": "2025-10-06T09:00:00.000+04:00", "durationMinutes": 60, "description": "", "recurrencePattern": "WEEKLY;BYDAY=MO,TU,WE,TH,FR", "confidence": 0.95}

SINGLE CREATE - Every N weeks:
Input: "team meeting every 2 weeks on Monday at 10am"
Output: {"intent": "create", "title": "Team meeting", "startDateTime": "2025-10-06T10:00:00.000+04:00", "durationMinutes": 60, "description": "", "recurrencePattern": "WEEKLY;INTERVAL=2;BYDAY=MO", "confidence": 0.95}

SINGLE CREATE - Specific days:
Input: "yoga class every Monday and Wednesday at 7pm"
Output: {"intent": "create", "title": "Yoga class", "startDateTime": "2025-10-06T19:00:00.000+04:00", "durationMinutes": 60, "description": "", "recurrencePattern": "WEEKLY;BYDAY=MO,WE", "confidence": 0.95}

MULTIPLE CREATE:
Input: "Training sessions: 101 on Monday 6 Oct at 11:30 AM in Visitors Center, and 102 on Tuesday 7 Oct at 12 PM in Lecture Hall 1"
Output: {"intent": "create_multiple", "events": [{"title": "Training 101", "startDateTime": "2025-10-06T11:30:00.000+04:00", "durationMinutes": 60, "description": "Venue: Visitors Center", "recurrencePattern": null}, {"title": "Training 102", "startDateTime": "2025-10-07T12:00:00.000+04:00", "durationMinutes": 60, "description": "Venue: Lecture Hall 1", "recurrencePattern": null}], "confidence": 0.95}

DELETE:
Input: "delete the repeating gym event"
Output: {"intent": "delete", "searchQuery": "gym repeating", "confidence": 0.9}

MODIFY:
Input: "move gym to 7am"
Output: {"intent": "modify", "searchQuery": "gym", "changes": {"time": "7am"}, "confidence": 0.9}

CRITICAL:
- ALWAYS include "intent" field
- For CREATE: Description must be CONCISE bullet-style reminders, NOT full sentences
- For MULTIPLE events: Use "create_multiple" intent with "events" array
- For DELETE/MODIFY: searchQuery should be the key terms to match events
- Return ONLY the JSON.`;

    const response = await fetch(`${OPENAI_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('LLM Parser - API ERROR:', {
        status: response.status,
        statusText: response.statusText,
        error: error,
      });

      // Check if it's a quota/rate limit error
      const errorMessage = error.error?.message || error.message || response.statusText;
      const isQuotaError =
        response.status === 429 ||
        errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('insufficient');

      if (isQuotaError) {
        return {
          success: false,
          error: '🚫 API quota used up for today. Please try again tomorrow morning when capacity resets.',
        };
      }

      return {
        success: false,
        error: `API error: ${errorMessage}`,
      };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: 'No response from LLM',
      };
    }

    // Parse the LLM response
    const parsed = JSON.parse(content.trim());

    console.log('LLM Parser - Raw response:', content);
    console.log('LLM Parser - Parsed data:', parsed);

    const intent = parsed.intent || 'create'; // Default to create for backward compatibility

    if (intent === 'delete') {
      return {
        success: true,
        intent: {
          intent: 'delete',
          searchQuery: parsed.searchQuery,
          confidence: parsed.confidence,
        },
      };
    }

    if (intent === 'modify') {
      return {
        success: true,
        intent: {
          intent: 'modify',
          searchQuery: parsed.searchQuery,
          changes: parsed.changes || {},
          confidence: parsed.confidence,
        },
      };
    }

    // CREATE_MULTIPLE intent - handle multiple events
    if (intent === 'create_multiple') {
      const drafts: EventDraft[] = parsed.events.map((event: any) => {
        const startDateTime = DateTime.fromISO(event.startDateTime, { zone: tz });
        const endDateTime = startDateTime.plus({ minutes: event.durationMinutes });

        // Only include description if it has actual content
        const hasDescription = event.description && event.description.trim().length > 0;

        // Generate RRULE from recurrence pattern
        let rrule: string | undefined;
        if (event.recurrencePattern) {
          // If pattern already contains FREQ, use as-is, otherwise wrap with RRULE:FREQ=
          if (event.recurrencePattern.includes('FREQ=')) {
            rrule = `RRULE:${event.recurrencePattern}`;
          } else {
            rrule = `RRULE:FREQ=${event.recurrencePattern}`;
          }
        }

        return {
          title: event.title,
          startISO: startDateTime.toISO()!,
          endISO: endDateTime.toISO()!,
          tz,
          description: hasDescription ? event.description.trim() : undefined,
          recurrence: rrule,
          needsTimeConfirmation: event.needsTimeConfirmation || false,
        };
      });

      console.log('LLM Parser - Multiple events drafts:', drafts);

      return {
        success: true,
        intent: {
          intent: 'create_multiple',
          drafts,
          confidence: parsed.confidence,
        },
      };
    }

    // SINGLE CREATE intent
    const startDateTime = DateTime.fromISO(parsed.startDateTime, { zone: tz });
    const endDateTime = startDateTime.plus({ minutes: parsed.durationMinutes });

    // Only include description if it has actual content
    const hasDescription = parsed.description && parsed.description.trim().length > 0;

    // Generate RRULE from recurrence pattern
    let rrule: string | undefined;
    if (parsed.recurrencePattern) {
      // If pattern already contains FREQ, use as-is, otherwise wrap with RRULE:FREQ=
      if (parsed.recurrencePattern.includes('FREQ=')) {
        rrule = `RRULE:${parsed.recurrencePattern}`;
      } else {
        rrule = `RRULE:FREQ=${parsed.recurrencePattern}`;
      }
    }

    const draft: EventDraft = {
      title: parsed.title,
      startISO: startDateTime.toISO()!,
      endISO: endDateTime.toISO()!,
      tz,
      description: hasDescription ? parsed.description.trim() : undefined,
      recurrence: rrule,
      needsTimeConfirmation: parsed.needsTimeConfirmation || false,
    };

    console.log('LLM Parser - Final draft:', draft);

    return {
      success: true,
      intent: {
        intent: 'create',
        draft,
        confidence: parsed.confidence,
      },
      // Legacy support
      draft,
      confidence: parsed.confidence,
    };
  } catch (error) {
    console.error('LLM parsing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse with LLM',
    };
  }
}

/**
 * Check if API key is configured (always true now with fixed key)
 */
export async function hasApiKey(): Promise<boolean> {
  return true;
}
