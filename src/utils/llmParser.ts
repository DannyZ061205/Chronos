import { DateTime } from 'luxon';
import type { EventDraft, ParseResult } from '@/types';

/**
 * LLM-powered event parser using OpenAI API
 * Parses natural language into structured event data
 */

// API configuration - hardcoded for all users
const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';
// Key split into parts to make extraction slightly harder
const _p1 = 'sk-proj-RDTYgp2CkfEJZSyFcNBhxkDhswaPfmjdkPihs0lI1sidm6peUtdsaikF8s';
const _p2 = 'GTe6tchld3J1d9NYT3BlbkFJcDFDAfgIW_cb6q7bsno61QNvFdK6vxqQBjO5YWU';
const _p3 = 'ty92FAYi0yJZkeFRJx5IQziO2VXlesI8gkA';
const OPENAI_API_KEY = _p1 + _p2 + _p3;

/**
 * Parse event using LLM
 * The LLM will infer appropriate event durations based on event type
 */
export async function parseLLMEvent(
  text: string,
  timezone?: string
): Promise<ParseResult> {
  try {
    const apiKey = OPENAI_API_KEY;

    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = DateTime.now().setZone(tz);

    const systemPrompt = `You are a calendar event assistant. Detect user intent (create/delete/modify events) and extract relevant details.

TODAY IS: ${now.toFormat('EEEE, MMMM d, yyyy')} (${now.toFormat('EEEE')} is the current day of the week)
Current exact time: ${now.toISO()}
Timezone: ${tz}

IMPORTANT: When interpreting relative day references:
- "today" = ${now.toFormat('EEEE, MMMM d, yyyy')}
- "tomorrow" = ${now.plus({ days: 1 }).toFormat('EEEE, MMMM d, yyyy')}
- "Tuesday" (or any day name) = the NEXT occurrence of that day from today
- If today is ${now.toFormat('EEEE')}, then "Tuesday" means ${now.plus({ days: (2 - now.weekday + 7) % 7 || 7 }).toFormat('MMMM d, yyyy')}

INTENT DETECTION:
- CREATE: "add", "create", "schedule", "book", event descriptions without keywords
- DELETE: "delete", "remove", "cancel", "clear"
- MODIFY: "change", "move", "update", "reschedule", "edit"
- VIEW: "what do I have", "show me", "list", "view", "what's on", "my events", "my schedule"
- MULTIPLE_COMMANDS: When input contains MULTIPLE distinct commands with DIFFERENT intents separated by punctuation (?, !, .) or conjunctions (and, also, then)

MULTIPLE COMMANDS (different intents in one input):
- If input contains MULTIPLE distinct commands with DIFFERENT INTENT TYPES, return "multiple_commands"
- Examples: "What do I have Friday? Create gym at 10" (VIEW + CREATE), "Delete meeting. Add lunch tomorrow" (DELETE + CREATE)
- Each command gets its own intent object in the "commands" array
- Each command must have a DIFFERENT intent type (not just multiple events of same type)
- This is DIFFERENT from create_multiple (which is multiple events, all with CREATE intent)

MULTIPLE EVENTS (same intent):
- If the input contains MULTIPLE distinct events with different times/dates, extract ALL of them
- Each event should be a separate object in an "events" array
- Common in emails, announcements, or lists of events

RULES FOR EVENT CREATION:
1. Title: Extract ONLY the event name (e.g., "Go to gym", "ChatGPT EDU 101 Training - In-Person")
2. Time Detection: If the user does NOT provide a specific time (like "3pm", "at 10:00", "noon"), set "needsTimeConfirmation": true
   - Examples that NEED time: "go to gym tomorrow", "meeting on Friday", "dinner next week", "gym everyday starting tomorrow"
   - Examples that DON'T need time: "gym at 6am", "meeting Friday 3pm", "dinner next week at 7pm", "gym everyday at 6am"
   - IMPORTANT: Apply this rule EVEN for recurring events! If no time specified, set needsTimeConfirmation: true
   - When needsTimeConfirmation is true, use current time as placeholder but flag it for confirmation
3. Duration: ALWAYS infer an appropriate and reasonable duration based on the event type. Use your judgment:
   - Quick tasks/calls: 15-30 minutes (e.g., "quick call", "standup meeting", "coffee break")
   - Standard meetings: 30-60 minutes (e.g., "team meeting", "1-on-1", "review session")
   - Meals: 60-90 minutes (e.g., "lunch", "dinner", "breakfast meeting")
   - Workouts/gym: 60-90 minutes (e.g., "gym", "workout", "yoga class")
   - Training/workshops: 90-180 minutes (e.g., "training session", "workshop", "seminar")
   - Conferences/all-day: 240-480 minutes (e.g., "conference", "all-day event", "retreat")
   - Classes/lectures: 60-120 minutes (e.g., "class", "lecture", "course")
   - Extensive/long sessions: 180+ minutes (e.g., "extensive piano practice", "long study session")
   - If the user specifies duration explicitly (e.g., "2 hour meeting"), ALWAYS use that exact duration
   - Default to 60 minutes only if the event type is unclear or generic
   - IMPORTANT: ALWAYS set "needsDurationConfirmation": true so the user can review and adjust the suggested duration
4. Description: Format as clean multi-line list with category labels
   - Use line breaks (\n) to separate different types of information
   - Format with labels: "Bring: X, Y\nReminder: Z\nLocation: ABC"
   - Categories to use: "Bring:", "Reminder:", "Location:", "Topics:", "Notes:", etc.
   - Extract: Things to bring, locations (Zoom links, room numbers), topics to discuss, important notes, reminders
   - EXCLUDE: All timing/scheduling words ("everyday", "starting tomorrow", "at 6am", etc.)
   - Keep it SHORT - think "quick glance reminders", not full sentences
5. Recurrence: Support ADVANCED recurrence patterns:
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
6. Reminders: ALWAYS include a reminder for events
   - Default: Set "reminderMinutes": 60 (1 hour before) for all events
   - If user explicitly mentions reminder time (e.g., "remind me 15 min before"), use that value
   - Examples: "remind me 15 minutes before" → 15, "remind me 30 min before" → 30, "reminder 2 hours before" → 120
   - If user says "no reminder" or "don't remind me", set to 0
   - Always express in minutes before the event
7. If there's a dash (-), text after it usually goes to description

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
  "needsDurationConfirmation": true,
  "reminderMinutes": number,
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

FOR VIEW:
{
  "intent": "view",
  "timeframe": "natural language timeframe (e.g., 'Friday', 'this week', 'tomorrow', 'next Monday')",
  "startDateTime": "ISO datetime for start of range",
  "endDateTime": "ISO datetime for end of range",
  "confidence": number
}

FOR MULTIPLE_COMMANDS:
{
  "intent": "multiple_commands",
  "commands": [
    {/* First command as its own intent object (view/create/delete/modify) */},
    {/* Second command as its own intent object */}
  ],
  "confidence": number
}

Examples:

SINGLE CREATE - Simple recurrence WITH time:
Input: "go to gym everyday starting from tomorrow at 6am"
Output: {"intent": "create", "title": "Go to gym", "startDateTime": "2025-10-05T06:00:00.000+04:00", "durationMinutes": 90, "description": "", "recurrencePattern": "DAILY", "needsTimeConfirmation": false, "needsDurationConfirmation": true, "reminderMinutes": 60, "confidence": 0.95}

SINGLE CREATE - WITHOUT specific time (needs confirmation):
Input: "go to gym tomorrow"
Output: {"intent": "create", "title": "Go to gym", "startDateTime": "2025-10-05T${now.toFormat('HH:mm:ss')}", "durationMinutes": 90, "description": "", "recurrencePattern": null, "needsTimeConfirmation": true, "needsDurationConfirmation": true, "reminderMinutes": 60, "confidence": 0.95}

SINGLE CREATE - Extensive session (long duration):
Input: "piano practice extensive tonight"
Output: {"intent": "create", "title": "Piano practice", "startDateTime": "2025-10-04T${now.toFormat('HH:mm:ss')}", "durationMinutes": 180, "description": "", "recurrencePattern": null, "needsTimeConfirmation": true, "needsDurationConfirmation": true, "reminderMinutes": 60, "confidence": 0.95}

SINGLE CREATE - Custom reminder time:
Input: "meeting with Sarah tomorrow at 3pm, remind me 15 minutes before"
Output: {"intent": "create", "title": "Meeting with Sarah", "startDateTime": "2025-10-05T15:00:00.000+04:00", "durationMinutes": 60, "description": "", "recurrencePattern": null, "needsTimeConfirmation": false, "needsDurationConfirmation": true, "reminderMinutes": 15, "confidence": 0.95}

SINGLE CREATE - Recurring WITHOUT time (needs confirmation) with formatted description:
Input: "go to gym everyday starting from tomorrow. I need to bring a towel and a water bottle. Also, remind me to start workout mode on iwatch."
Output: {"intent": "create", "title": "Go to gym", "startDateTime": "2025-10-05T${now.toFormat('HH:mm:ss')}", "durationMinutes": 90, "description": "Bring: towel, water bottle\\nReminder: start workout mode on iwatch", "recurrencePattern": "DAILY", "needsTimeConfirmation": true, "needsDurationConfirmation": true, "confidence": 0.95}

SINGLE CREATE - Weekends:
Input: "go to gym 6am during weekends"
Output: {"intent": "create", "title": "Go to gym", "startDateTime": "2025-10-05T06:00:00.000+04:00", "durationMinutes": 90, "description": "", "recurrencePattern": "WEEKLY;BYDAY=SA,SU", "confidence": 0.95}

SINGLE CREATE - Weekdays (short standup):
Input: "standup meeting 9am every weekday"
Output: {"intent": "create", "title": "Standup meeting", "startDateTime": "2025-10-06T09:00:00.000+04:00", "durationMinutes": 15, "description": "", "recurrencePattern": "WEEKLY;BYDAY=MO,TU,WE,TH,FR", "confidence": 0.95}

SINGLE CREATE - Every N weeks:
Input: "team meeting every 2 weeks on Monday at 10am"
Output: {"intent": "create", "title": "Team meeting", "startDateTime": "2025-10-06T10:00:00.000+04:00", "durationMinutes": 60, "description": "", "recurrencePattern": "WEEKLY;INTERVAL=2;BYDAY=MO", "confidence": 0.95}

SINGLE CREATE - Specific days (yoga class):
Input: "yoga class every Monday and Wednesday at 7pm"
Output: {"intent": "create", "title": "Yoga class", "startDateTime": "2025-10-06T19:00:00.000+04:00", "durationMinutes": 90, "description": "", "recurrencePattern": "WEEKLY;BYDAY=MO,WE", "confidence": 0.95}

SINGLE CREATE - Lunch with explicit duration:
Input: "lunch with Sarah tomorrow at noon, should take about 2 hours"
Output: {"intent": "create", "title": "Lunch with Sarah", "startDateTime": "2025-10-05T12:00:00.000+04:00", "durationMinutes": 120, "description": "", "recurrencePattern": null, "needsTimeConfirmation": false, "confidence": 0.95}

MULTIPLE CREATE (training sessions):
Input: "Training sessions: 101 on Monday 6 Oct at 11:30 AM in Visitors Center, and 102 on Tuesday 7 Oct at 12 PM in Lecture Hall 1"
Output: {"intent": "create_multiple", "events": [{"title": "Training 101", "startDateTime": "2025-10-06T11:30:00.000+04:00", "durationMinutes": 120, "description": "Venue: Visitors Center", "recurrencePattern": null}, {"title": "Training 102", "startDateTime": "2025-10-07T12:00:00.000+04:00", "durationMinutes": 120, "description": "Venue: Lecture Hall 1", "recurrencePattern": null}], "confidence": 0.95}

DELETE:
Input: "delete the repeating gym event"
Output: {"intent": "delete", "searchQuery": "gym repeating", "confidence": 0.9}

MODIFY:
Input: "move gym to 7am"
Output: {"intent": "modify", "searchQuery": "gym", "changes": {"time": "7am"}, "confidence": 0.9}

VIEW:
Input: "what do I have for Friday?"
Output: {"intent": "view", "timeframe": "Friday", "startDateTime": "${now.plus({ days: (5 - now.weekday + 7) % 7 || 7 }).startOf('day').toISO()}", "endDateTime": "${now.plus({ days: (5 - now.weekday + 7) % 7 || 7 }).endOf('day').toISO()}", "confidence": 0.95}

VIEW (this week):
Input: "show me my events this week"
Output: {"intent": "view", "timeframe": "this week", "startDateTime": "${now.startOf('week').toISO()}", "endDateTime": "${now.endOf('week').toISO()}", "confidence": 0.95}

VIEW (tomorrow):
Input: "what's on my schedule tomorrow?"
Output: {"intent": "view", "timeframe": "tomorrow", "startDateTime": "${now.plus({ days: 1 }).startOf('day').toISO()}", "endDateTime": "${now.plus({ days: 1 }).endOf('day').toISO()}", "confidence": 0.95}

MULTIPLE_COMMANDS (VIEW + CREATE):
Input: "What do I have for Friday? go to gym at 10 today"
Output: {"intent": "multiple_commands", "commands": [{"intent": "view", "timeframe": "Friday", "startDateTime": "${now.plus({ days: (5 - now.weekday + 7) % 7 || 7 }).startOf('day').toISO()}", "endDateTime": "${now.plus({ days: (5 - now.weekday + 7) % 7 || 7 }).endOf('day').toISO()}", "confidence": 0.95}, {"intent": "create", "title": "Go to gym", "startDateTime": "${now.toFormat('yyyy-MM-dd')}T10:00:00.000${now.toFormat('ZZZ')}", "durationMinutes": 90, "description": "", "recurrencePattern": null, "needsTimeConfirmation": false, "needsDurationConfirmation": true, "reminderMinutes": 60, "confidence": 0.95}], "confidence": 0.95}

MULTIPLE_COMMANDS (DELETE + CREATE):
Input: "delete the gym event and create lunch tomorrow at noon"
Output: {"intent": "multiple_commands", "commands": [{"intent": "delete", "searchQuery": "gym", "confidence": 0.9}, {"intent": "create", "title": "Lunch", "startDateTime": "${now.plus({ days: 1 }).toFormat('yyyy-MM-dd')}T12:00:00.000${now.toFormat('ZZZ')}", "durationMinutes": 60, "description": "", "recurrencePattern": null, "needsTimeConfirmation": false, "needsDurationConfirmation": true, "reminderMinutes": 60, "confidence": 0.95}], "confidence": 0.9}

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

    if (intent === 'view') {
      return {
        success: true,
        intent: {
          intent: 'view',
          timeframe: parsed.timeframe,
          startISO: parsed.startDateTime,
          endISO: parsed.endDateTime,
          confidence: parsed.confidence,
        },
      };
    }

    if (intent === 'multiple_commands') {
      // Process each command individually and build array of intents
      const commands: any[] = [];

      for (const cmd of parsed.commands) {
        const cmdIntent = cmd.intent;

        if (cmdIntent === 'view') {
          commands.push({
            intent: 'view',
            timeframe: cmd.timeframe,
            startISO: cmd.startDateTime,
            endISO: cmd.endDateTime,
            confidence: cmd.confidence,
          });
        } else if (cmdIntent === 'delete') {
          commands.push({
            intent: 'delete',
            searchQuery: cmd.searchQuery,
            confidence: cmd.confidence,
          });
        } else if (cmdIntent === 'modify') {
          commands.push({
            intent: 'modify',
            searchQuery: cmd.searchQuery,
            changes: cmd.changes || {},
            confidence: cmd.confidence,
          });
        } else if (cmdIntent === 'create') {
          // Process create intent
          const startDateTime = DateTime.fromISO(cmd.startDateTime, { zone: tz });
          const endDateTime = startDateTime.plus({ minutes: cmd.durationMinutes });
          const hasDescription = cmd.description && cmd.description.trim().length > 0;

          let rrule: string | undefined;
          if (cmd.recurrencePattern) {
            if (cmd.recurrencePattern.includes('FREQ=')) {
              rrule = `RRULE:${cmd.recurrencePattern}`;
            } else {
              rrule = `RRULE:FREQ=${cmd.recurrencePattern}`;
            }
          }

          commands.push({
            intent: 'create',
            draft: {
              title: cmd.title,
              startISO: startDateTime.toISO()!,
              endISO: endDateTime.toISO()!,
              tz,
              description: hasDescription ? cmd.description.trim() : undefined,
              recurrence: rrule,
              needsTimeConfirmation: cmd.needsTimeConfirmation || false,
              needsDurationConfirmation: cmd.needsDurationConfirmation || false,
              suggestedDurationMinutes: cmd.durationMinutes,
              reminderMinutes: cmd.reminderMinutes !== undefined ? cmd.reminderMinutes : 60,
            },
            confidence: cmd.confidence,
          });
        }
      }

      return {
        success: true,
        intent: {
          intent: 'multiple_commands',
          commands,
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
          needsDurationConfirmation: event.needsDurationConfirmation || false,
          suggestedDurationMinutes: event.durationMinutes,
          reminderMinutes: event.reminderMinutes !== undefined ? event.reminderMinutes : 60, // Default to 60 minutes
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
      needsDurationConfirmation: parsed.needsDurationConfirmation || false,
      suggestedDurationMinutes: parsed.durationMinutes,
      reminderMinutes: parsed.reminderMinutes !== undefined ? parsed.reminderMinutes : 60, // Default to 60 minutes
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
