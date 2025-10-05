import type {
  CreateEventRequest,
  CreateEventResponse,
  CalendarResult,
  ListEventsRequest,
  ListEventsResponse,
  DeleteEventRequest,
  DeleteEventResponse,
  RestoreEventRequest,
  RestoreEventResponse,
  ModifyEventRequest,
  ModifyEventResponse,
  CalendarEvent
} from '../types';

// Offscreen document management
let creatingOffscreen: Promise<void> | null = null;

async function setupOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as any],
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA' as any],
      justification: 'Recording audio for voice input transcription',
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // Debug logging
  if (request.type === 'DEBUG_LOG') {
    console.log('[PopupStore DEBUG]', request.payload.message, request.payload);
    sendResponse({ ok: true });
    return;
  }

  // Handle voice recording requests
  if (request.type === 'START_RECORDING') {
    setupOffscreenDocument()
      .then(() => {
        return chrome.runtime.sendMessage({ type: 'START_RECORDING' });
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Error starting recording:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.type === 'STOP_RECORDING') {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Error stopping recording:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.type === 'CREATE_EVENT') {
    handleCreateEvent(request as CreateEventRequest)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error in handleCreateEvent:', error);
        sendResponse({
          ok: false,
          results: {
            google: { ok: false, code: 'ERROR', msg: error.message },
            outlook: { ok: false, code: 'ERROR', msg: error.message },
          },
        });
      });
    return true; // Keep channel open for async response
  }

  if (request.type === 'LIST_EVENTS') {
    handleListEvents(request as ListEventsRequest)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error in handleListEvents:', error);
        sendResponse({ ok: false, events: [], error: error.message });
      });
    return true;
  }

  if (request.type === 'DELETE_EVENT') {
    handleDeleteEvent(request as DeleteEventRequest)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error in handleDeleteEvent:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (request.type === 'MODIFY_EVENT') {
    handleModifyEvent(request as ModifyEventRequest)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error in handleModifyEvent:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (request.type === 'RESTORE_EVENT') {
    handleRestoreEvent(request as RestoreEventRequest)
      .then(sendResponse)
      .catch((error) => {
        console.error('Error in handleRestoreEvent:', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }
});

/**
 * Handle event creation across calendars
 */
async function handleCreateEvent(request: CreateEventRequest): Promise<CreateEventResponse> {
  const { payload } = request;
  const results: CreateEventResponse['results'] = {};
  
  // Create Google Calendar event if requested
  if (payload.targets.google) {
    results.google = await createGoogleCalendarEvent(payload);
  }
  
  // Create Outlook Calendar event if requested
  if (payload.targets.outlook) {
    results.outlook = await createOutlookCalendarEvent(payload);
  }
  
  // Determine overall success
  const googleOk = results.google?.ok ?? true; // true if not attempted
  const outlookOk = results.outlook?.ok ?? true;
  
  return {
    ok: googleOk && outlookOk,
    results,
  };
}

/**
 * Create Google Calendar event
 */
async function createGoogleCalendarEvent(
  payload: CreateEventRequest['payload']
): Promise<CalendarResult> {
  try {
    // Get auth token
    const token = await getGoogleAuthToken();
    
    if (!token) {
      return {
        ok: false,
        code: 'AUTH_FAILED',
        msg: 'Failed to authenticate with Google Calendar',
      };
    }
    
    // Create event payload
    const eventPayload: any = {
      summary: payload.title,
      start: {
        dateTime: payload.startISO,
        timeZone: payload.tz,
      },
      end: {
        dateTime: payload.endISO,
        timeZone: payload.tz,
      },
    };

    console.log('Google Calendar - Payload description:', payload.description);

    // Add description if provided
    if (payload.description) {
      console.log('Google Calendar - Adding description to eventPayload:', payload.description);
      eventPayload.description = payload.description;
    }

    console.log('Google Calendar - Final eventPayload:', eventPayload);

    // Add recurrence if provided
    if (payload.recurrence) {
      eventPayload.recurrence = [payload.recurrence];
    }

    console.log('Google Calendar - About to send to API:', JSON.stringify(eventPayload, null, 2));

    // Make API call
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      }
    );

    console.log('Google Calendar - API Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('Google Calendar - API Error data:', errorData);
      
      // Handle specific error codes
      if (response.status === 401) {
        // Token expired, try to refresh
        await chrome.identity.removeCachedAuthToken({ token });
        return {
          ok: false,
          code: 'AUTH_GOOGLE_401',
          msg: 'Google Calendar authentication expired. Please reconnect.',
        };
      }
      
      return {
        ok: false,
        code: `HTTP_${response.status}`,
        msg: errorData.error?.message || `Failed to create Google Calendar event (${response.status})`,
      };
    }

    const data = await response.json();
    console.log('Google Calendar - Success response data:', data);

    // Mark Google as connected
    await chrome.storage.local.set({ googleConnected: true });

    return {
      ok: true,
      eventId: data.id,
    };
  } catch (error) {
    console.error('Google Calendar error:', error);
    return {
      ok: false,
      code: 'NETWORK_ERROR',
      msg: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get Google auth token
 */
async function getGoogleAuthToken(): Promise<string | null> {
  try {
    const token = await chrome.identity.getAuthToken({ interactive: true });
    return token.token || null;
  } catch (error) {
    console.error('Google auth error:', error);
    return null;
  }
}

/**
 * Create Outlook Calendar event
 */
async function createOutlookCalendarEvent(
  payload: CreateEventRequest['payload']
): Promise<CalendarResult> {
  try {
    // Get MSAL token
    const token = await getOutlookAuthToken();
    
    if (!token) {
      return {
        ok: false,
        code: 'AUTH_FAILED',
        msg: 'Failed to authenticate with Outlook Calendar',
      };
    }
    
    // Create event payload (Microsoft Graph format)
    const eventPayload: any = {
      subject: payload.title,
      start: {
        dateTime: payload.startISO.split('+')[0].split('Z')[0], // Remove timezone offset
        timeZone: payload.tz,
      },
      end: {
        dateTime: payload.endISO.split('+')[0].split('Z')[0], // Remove timezone offset
        timeZone: payload.tz,
      },
    };

    console.log('Outlook Calendar - Payload description:', payload.description);

    // Add description/body if provided
    if (payload.description) {
      console.log('Outlook Calendar - Adding description to eventPayload:', payload.description);
      eventPayload.body = {
        contentType: 'text',
        content: payload.description,
      };
    }

    console.log('Outlook Calendar - Final eventPayload:', eventPayload);

    // Add recurrence if provided
    if (payload.recurrence) {
      // Convert iCal RRULE to Microsoft Graph format
      const rrule = payload.recurrence;
      console.log('Outlook Calendar - Original RRULE from payload:', rrule);
      const pattern: any = { interval: 1 };
      const daysOfWeek: string[] = [];

      // Parse FREQ
      const freqMatch = rrule.match(/FREQ=(\w+)/);
      if (freqMatch) {
        const freq = freqMatch[1].toLowerCase();
        if (freq === 'daily') pattern.type = 'daily';
        else if (freq === 'weekly') pattern.type = 'weekly';
        else if (freq === 'monthly') pattern.type = 'absoluteMonthly';
        else if (freq === 'yearly') pattern.type = 'absoluteYearly';
      }

      // Parse INTERVAL
      const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
      if (intervalMatch) {
        pattern.interval = parseInt(intervalMatch[1]);
      }

      // Parse BYDAY (day of week)
      const byDayMatch = rrule.match(/BYDAY=([A-Z,]+)/);
      if (byDayMatch) {
        const days = byDayMatch[1].split(',');
        const dayMap: Record<string, string> = {
          'MO': 'monday',
          'TU': 'tuesday',
          'WE': 'wednesday',
          'TH': 'thursday',
          'FR': 'friday',
          'SA': 'saturday',
          'SU': 'sunday'
        };

        days.forEach(day => {
          if (dayMap[day]) {
            daysOfWeek.push(dayMap[day]);
          }
        });

        if (daysOfWeek.length > 0) {
          pattern.daysOfWeek = daysOfWeek;
        }
      }

      eventPayload.recurrence = {
        pattern,
        range: { type: 'noEnd', startDate: payload.startISO.split('T')[0] },
      };

      console.log('Outlook Calendar - Converted recurrence pattern:', JSON.stringify(eventPayload.recurrence, null, 2));
    }

    console.log('Outlook Calendar - About to send to API:', JSON.stringify(eventPayload, null, 2));

    // Make API call
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      }
    );

    console.log('Outlook Calendar - API Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('Outlook Calendar - API Error data:', errorData);

      // Handle specific error codes
      if (response.status === 401) {
        return {
          ok: false,
          code: 'AUTH_MS_401',
          msg: 'Outlook Calendar authentication expired. Please reconnect.',
        };
      }

      return {
        ok: false,
        code: `HTTP_${response.status}`,
        msg: errorData.error?.message || `Failed to create Outlook Calendar event (${response.status})`,
      };
    }

    const data = await response.json();
    console.log('Outlook Calendar - Success response data:', data);

    // Mark Outlook as connected
    await chrome.storage.local.set({ outlookConnected: true });

    return {
      ok: true,
      eventId: data.id,
    };
  } catch (error) {
    console.error('Outlook Calendar error:', error);
    return {
      ok: false,
      code: 'NETWORK_ERROR',
      msg: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get Outlook/Microsoft auth token with automatic refresh
 */
async function getOutlookAuthToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get([
      'outlookToken',
      'outlookTokenExpiry',
      'outlookRefreshToken'
    ]);

    const token = result.outlookToken;
    const expiry = result.outlookTokenExpiry;
    const refreshToken = result.outlookRefreshToken;

    if (!token) {
      return null;
    }

    // Check if token is expired or will expire in next 10 minutes (more aggressive)
    const expiryBuffer = 10 * 60 * 1000; // 10 minutes
    if (expiry && expiry < Date.now() + expiryBuffer) {
      console.log('Outlook token expired/expiring soon, attempting refresh...');
      console.log('Token expiry:', new Date(expiry).toISOString());
      console.log('Current time:', new Date().toISOString());

      // Try to refresh the token
      if (refreshToken) {
        console.log('Refresh token available, attempting to refresh...');
        const newToken = await refreshOutlookToken(refreshToken);
        if (newToken) {
          console.log('Token refresh successful!');
          return newToken;
        } else {
          console.error('Token refresh failed. Clearing auth data.');
        }
      } else {
        console.error('No refresh token available!');
      }

      // Refresh failed, clear tokens
      await chrome.storage.local.remove(['outlookToken', 'outlookTokenExpiry', 'outlookRefreshToken', 'outlookConnected']);
      console.log('Outlook auth cleared. User needs to reconnect.');
      return null;
    }

    return token;
  } catch (error) {
    console.error('Outlook auth error:', error);
    return null;
  }
}

/**
 * Refresh Outlook access token using refresh token (public client - no secret needed)
 */
async function refreshOutlookToken(refreshToken: string): Promise<string | null> {
  try {
    const clientId = 'ca0fddd7-53ce-4f46-8a7d-4bab1f70ced0';
    const scope = 'https://graph.microsoft.com/Calendars.ReadWrite offline_access';

    console.log('Attempting to refresh Outlook token...');

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        scope: scope,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', response.status, errorText);

      // Try to parse error details
      try {
        const errorJson = JSON.parse(errorText);
        console.error('Error details:', errorJson);

        if (errorJson.error === 'invalid_grant') {
          console.error('Refresh token is invalid or expired. User needs to reconnect.');
        }
      } catch (e) {
        // Error text wasn't JSON
      }

      // If refresh token is invalid/expired, clear all Outlook auth data
      if (response.status === 400 || response.status === 401) {
        console.log('Refresh token invalid/expired, clearing auth data');
        await chrome.storage.local.remove([
          'outlookToken',
          'outlookRefreshToken',
          'outlookTokenExpiry',
          'outlookConnected'
        ]);
      }

      return null;
    }

    const tokens = await response.json();

    // Verify we received access token
    if (!tokens.access_token) {
      console.error('No access token in refresh response');
      return null;
    }

    // Store new tokens (refresh token might not always be included, keep the old one if not)
    const tokenData: any = {
      outlookToken: tokens.access_token,
      outlookTokenExpiry: Date.now() + (tokens.expires_in * 1000),
      outlookConnected: true,
    };

    if (tokens.refresh_token) {
      tokenData.outlookRefreshToken = tokens.refresh_token;
    }

    await chrome.storage.local.set(tokenData);

    console.log('Outlook token refreshed successfully, expires in', tokens.expires_in, 'seconds');
    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing Outlook token:', error);
    return null;
  }
}

/**
 * List upcoming events from calendars
 */
async function handleListEvents(request: ListEventsRequest): Promise<ListEventsResponse> {
  const { sources, maxResults = 10 } = request.payload;
  const allEvents: CalendarEvent[] = [];

  try {
    // Fetch from Google Calendar
    if (sources.google) {
      const googleEvents = await listGoogleEvents(maxResults);
      allEvents.push(...googleEvents);
    }

    // Fetch from Outlook Calendar
    if (sources.outlook) {
      const outlookEvents = await listOutlookEvents(maxResults);
      allEvents.push(...outlookEvents);
    }

    // Sort by start time
    allEvents.sort((a, b) => a.startISO.localeCompare(b.startISO));

    return {
      ok: true,
      events: allEvents,
    };
  } catch (error) {
    return {
      ok: false,
      events: [],
      error: error instanceof Error ? error.message : 'Failed to list events',
    };
  }
}

/**
 * List Google Calendar events
 */
async function listGoogleEvents(maxResults: number): Promise<CalendarEvent[]> {
  try {
    const token = await getGoogleAuthToken();
    console.log('List Google Events - Token:', token ? 'Found' : 'Not found');

    if (!token) {
      console.error('List Google Events - No auth token');
      return [];
    }

    const now = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${now}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;

    console.log('List Google Events - Fetching:', url);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    console.log('List Google Events - Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('List Google Events - Error:', errorData);
      return [];
    }

    const data = await response.json();
    console.log('List Google Events - Items found:', data.items?.length || 0);

    return (data.items || []).map((item: any) => {
      const hasRecurrence = item.recurrence && item.recurrence.length > 0;
      const hasRecurringEventId = item.recurringEventId !== undefined && item.recurringEventId !== null;

      return {
        id: item.id,
        title: item.summary || 'Untitled',
        startISO: item.start.dateTime || item.start.date,
        endISO: item.end.dateTime || item.end.date,
        description: item.description,
        // For expanded instances, use recurringEventId to indicate it's part of a series
        // For master events, use the recurrence rule
        recurrence: hasRecurrence ? item.recurrence[0] : (hasRecurringEventId ? 'RECURRING_INSTANCE' : undefined),
        location: item.location,
        source: 'google' as const,
      };
    });
  } catch (error) {
    console.error('List Google Events - Exception:', error);
    return [];
  }
}

/**
 * List Outlook Calendar events
 */
async function listOutlookEvents(maxResults: number): Promise<CalendarEvent[]> {
  const token = await getOutlookAuthToken();
  if (!token) return [];

  const now = new Date().toISOString();
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/events?` +
    `$filter=start/dateTime ge '${now}'&$top=${maxResults}&$orderby=start/dateTime`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) return [];

  const data = await response.json();
  return (data.value || []).map((item: any) => ({
    id: item.id,
    title: item.subject || 'Untitled',
    startISO: item.start.dateTime,
    endISO: item.end.dateTime,
    description: item.body?.content,
    // For instances, type will be 'occurrence' or 'exception'
    // For master events, recurrence object exists
    recurrence: item.recurrence ? JSON.stringify(item.recurrence) : (item.type === 'occurrence' || item.type === 'exception' || item.seriesMasterId ? 'RECURRING_INSTANCE' : undefined),
    location: item.location?.displayName,
    source: 'outlook' as const,
  }));
}

/**
 * Delete an event from calendar
 */
async function handleDeleteEvent(request: DeleteEventRequest): Promise<DeleteEventResponse> {
  const { eventId, source, recurringScope } = request.payload;

  try {
    if (source === 'google') {
      return await deleteGoogleEvent(eventId, recurringScope);
    } else {
      return await deleteOutlookEvent(eventId, recurringScope);
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to delete event',
    };
  }
}

/**
 * Delete Google Calendar event
 * @param recurringScope - How to handle recurring events: 'this' (only this instance), 'following' (this and future), 'all' (entire series)
 */
async function deleteGoogleEvent(eventId: string, recurringScope?: string): Promise<DeleteEventResponse> {
  const token = await getGoogleAuthToken();
  if (!token) {
    return { ok: false, error: 'Not authenticated with Google Calendar' };
  }

  try {
    console.log('[DELETE] Event ID:', eventId, 'Scope:', recurringScope);

    // Check if this is an instance ID (format: masterId_instanceDateTime)
    const isInstanceId = eventId.includes('_');

    if (isInstanceId && recurringScope === 'this') {
      // This is a specific instance - just cancel it directly
      console.log('[DELETE] Cancelling specific instance:', eventId);
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'cancelled' }),
        }
      );

      if (!response.ok) {
        return { ok: false, error: 'Failed to cancel event instance' };
      }

      return { ok: true };
    }

    if (isInstanceId && recurringScope === 'all') {
      // Extract master event ID and cancel the whole series
      const masterEventId = eventId.split('_')[0];
      console.log('[DELETE] Cancelling entire series, master ID:', masterEventId);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${masterEventId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'cancelled' }),
        }
      );

      if (!response.ok) {
        return { ok: false, error: 'Failed to cancel recurring series' };
      }

      return { ok: true };
    }

    // Not an instance ID - handle as before
    // Soft delete: Cancel the event instead of deleting it
    console.log('[DELETE] Cancelling event:', eventId);
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      }
    );

    if (!response.ok) {
      return { ok: false, error: 'Failed to cancel Google Calendar event' };
    }

    return { ok: true };
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Delete Outlook Calendar event
 * @param recurringScope - How to handle recurring events: 'this' (only this instance), 'following' (this and future), 'all' (entire series)
 */
async function deleteOutlookEvent(eventId: string, recurringScope?: string): Promise<DeleteEventResponse> {
  const token = await getOutlookAuthToken();
  if (!token) {
    return { ok: false, error: 'Not authenticated with Outlook Calendar' };
  }

  try {
    // Check if this is a recurring event by fetching event details first
    const getResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!getResponse.ok) {
      return { ok: false, error: 'Failed to fetch event details' };
    }

    const event = await getResponse.json();
    const isRecurring = event.recurrence !== null && event.recurrence !== undefined;

    if (!isRecurring || !recurringScope || recurringScope === 'all') {
      // Delete entire event/series
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        return { ok: false, error: 'Failed to delete Outlook Calendar event' };
      }

      return { ok: true };
    }

    if (recurringScope === 'this') {
      // For 'this' instance only: Get the first occurrence and delete it
      const instancesResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}/instances?$top=1`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!instancesResponse.ok) {
        return { ok: false, error: 'Failed to fetch event instances' };
      }

      const instancesData = await instancesResponse.json();
      if (!instancesData.value || instancesData.value.length === 0) {
        return { ok: false, error: 'No instances found for recurring event' };
      }

      const firstInstance = instancesData.value[0];

      // Delete the specific instance
      const deleteInstanceResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${firstInstance.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!deleteInstanceResponse.ok) {
        return { ok: false, error: 'Failed to delete event instance' };
      }

      return { ok: true };
    }

    if (recurringScope === 'following') {
      // For 'this and following': Update the recurrence pattern to end before this occurrence
      const instancesResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}/instances?$top=1`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!instancesResponse.ok) {
        return { ok: false, error: 'Failed to fetch event instances' };
      }

      const instancesData = await instancesResponse.json();
      if (!instancesData.value || instancesData.value.length === 0) {
        return { ok: false, error: 'No instances found for recurring event' };
      }

      const firstInstance = instancesData.value[0];
      const instanceDate = new Date(firstInstance.start.dateTime);

      // Calculate the date before this instance (subtract 1 day)
      const endDate = new Date(instanceDate);
      endDate.setDate(endDate.getDate() - 1);

      // Update the recurrence pattern to end before this instance
      const updatedRecurrence = {
        ...event.recurrence,
        range: {
          ...event.recurrence.range,
          type: 'endDate',
          endDate: endDate.toISOString().split('T')[0],
        },
      };

      const patchResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recurrence: updatedRecurrence,
          }),
        }
      );

      if (!patchResponse.ok) {
        const errorData = await patchResponse.json().catch(() => ({}));
        console.error('Failed to update Outlook recurrence:', errorData);
        return { ok: false, error: 'Failed to update recurrence pattern' };
      }

      return { ok: true };
    }

    return { ok: false, error: 'Invalid recurring scope' };
  } catch (error) {
    console.error('Error deleting Outlook Calendar event:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Handle event restoration (undo delete)
 */
async function handleRestoreEvent(request: RestoreEventRequest): Promise<RestoreEventResponse> {
  const { eventId, source } = request.payload;

  try {
    if (source === 'google') {
      return await restoreGoogleEvent(eventId);
    } else {
      return await restoreOutlookEvent(eventId);
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to restore event',
    };
  }
}

/**
 * Restore Google Calendar event (un-cancel it)
 */
async function restoreGoogleEvent(eventId: string): Promise<RestoreEventResponse> {
  console.log('[RESTORE] Attempting to restore Google event:', eventId);

  const token = await getGoogleAuthToken();
  if (!token) {
    console.error('[RESTORE] No auth token');
    return { ok: false, error: 'Not authenticated with Google Calendar' };
  }

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;

    console.log('[RESTORE] Sending PATCH to uncanceled event:', eventId);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'confirmed' }),
    });

    console.log('[RESTORE] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[RESTORE] Error response:', errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }

      return {
        ok: false,
        error: errorData.error?.message || `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = await response.json();
    console.log('[RESTORE] Success:', result);
    return { ok: true };
  } catch (error) {
    console.error('[RESTORE] Exception:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Restore Outlook Calendar event (un-cancel it)
 */
async function restoreOutlookEvent(eventId: string): Promise<RestoreEventResponse> {
  const token = await getOutlookAuthToken();
  if (!token) {
    return { ok: false, error: 'Not authenticated with Outlook Calendar' };
  }

  try {
    const url = `https://graph.microsoft.com/v1.0/me/events/${eventId}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isCancelled: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: errorData.error?.message || 'Failed to restore event',
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle event modification
 */
async function handleModifyEvent(request: ModifyEventRequest): Promise<ModifyEventResponse> {
  const { eventId, source, updates, recurringScope } = request.payload;

  try {
    if (source === 'google') {
      return await modifyGoogleEvent(eventId, updates, recurringScope);
    } else {
      return await modifyOutlookEvent(eventId, updates, recurringScope);
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to modify event',
    };
  }
}

/**
 * Modify Google Calendar event
 */
async function modifyGoogleEvent(
  eventId: string,
  updates: ModifyEventRequest['payload']['updates'],
  recurringScope?: string
): Promise<ModifyEventResponse> {
  const token = await getGoogleAuthToken();
  if (!token) {
    console.error('[MODIFY] Not authenticated');
    return { ok: false, error: 'Not authenticated with Google Calendar' };
  }

  try {
    console.log('[MODIFY] Event ID:', eventId);
    console.log('[MODIFY] Recurring scope:', recurringScope);
    console.log('[MODIFY] Updates:', updates);

    // For recurring events with "all" scope, we need to get the master event ID
    // Instance IDs have format: masterEventId_instanceDateTime (e.g., abc123_20251006T083000Z)
    let targetEventId = eventId;
    let isRecurringAll = false;

    if (recurringScope === 'all' && eventId.includes('_')) {
      // Extract master event ID from instance ID
      targetEventId = eventId.split('_')[0];
      isRecurringAll = true;
      console.log('[MODIFY] Extracted master event ID:', targetEventId);
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${targetEventId}`;

    // For recurring events with "all" scope, we need to fetch the master event first
    // to preserve the recurrence rules while updating the base time
    if (isRecurringAll && (updates.startISO || updates.endISO)) {
      console.log('[MODIFY] Fetching master event for recurring update...');
      const getResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!getResponse.ok) {
        return { ok: false, error: 'Failed to fetch master event' };
      }

      const masterEvent = await getResponse.json();
      console.log('[MODIFY] Master event fetched:', masterEvent);

      // For recurring events, we need to preserve ALL fields from the master event
      // and only update the fields that are being changed
      const updateBody: any = { ...masterEvent };

      // Remove read-only fields that shouldn't be sent in PUT
      delete updateBody.kind;
      delete updateBody.etag;
      delete updateBody.htmlLink;
      delete updateBody.created;
      delete updateBody.updated;
      delete updateBody.iCalUID;
      delete updateBody.sequence;
      delete updateBody.organizer;
      delete updateBody.creator;

      if (updates.startISO && updates.endISO) {
        const isAllDay = !updates.startISO.includes('T');

        if (isAllDay) {
          updateBody.start = { date: updates.startISO.split('T')[0] };
          updateBody.end = { date: updates.endISO.split('T')[0] };
        } else {
          updateBody.start = { dateTime: updates.startISO };
          updateBody.end = { dateTime: updates.endISO };

          // Preserve timezone if it exists
          if (masterEvent.start?.timeZone) {
            updateBody.start.timeZone = masterEvent.start.timeZone;
          }
          if (masterEvent.end?.timeZone) {
            updateBody.end.timeZone = masterEvent.end.timeZone;
          }
        }
      }

      if (updates.title !== undefined) {
        updateBody.summary = updates.title;
      }

      if (updates.description !== undefined) {
        updateBody.description = updates.description;
      }

      if (updates.location !== undefined) {
        updateBody.location = updates.location;
      }

      console.log('[MODIFY] Recurring update body:', JSON.stringify(updateBody, null, 2));

      const response = await fetch(url, {
        method: 'PUT', // Use PUT for full replacement to ensure recurrence is preserved
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateBody),
      });

      console.log('[MODIFY] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MODIFY] Error response:', errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }

        return {
          ok: false,
          error: errorData.error?.message || `HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();
      console.log('[MODIFY] Success:', result);
      return { ok: true };
    }

    // For non-recurring or single instance updates
    const updateBody: any = {};

    if (updates.title !== undefined) {
      updateBody.summary = updates.title;
    }

    if (updates.startISO !== undefined && updates.endISO !== undefined) {
      const isAllDay = !updates.startISO.includes('T');

      if (isAllDay) {
        updateBody.start = { date: updates.startISO.split('T')[0] };
        updateBody.end = { date: updates.endISO.split('T')[0] };
      } else {
        updateBody.start = { dateTime: updates.startISO };
        updateBody.end = { dateTime: updates.endISO };
      }
    }

    if (updates.description !== undefined) {
      updateBody.description = updates.description;
    }

    if (updates.location !== undefined) {
      updateBody.location = updates.location;
    }

    console.log('[MODIFY] Update body:', JSON.stringify(updateBody, null, 2));

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateBody),
    });

    console.log('[MODIFY] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MODIFY] Error response:', errorText);

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }

      return {
        ok: false,
        error: errorData.error?.message || `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = await response.json();
    console.log('[MODIFY] Success:', result);
    return { ok: true };
  } catch (error) {
    console.error('[MODIFY] Exception:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Modify Outlook Calendar event
 */
async function modifyOutlookEvent(
  eventId: string,
  updates: ModifyEventRequest['payload']['updates'],
  _recurringScope?: string
): Promise<ModifyEventResponse> {
  const token = await getOutlookAuthToken();
  if (!token) {
    return { ok: false, error: 'Not authenticated with Outlook Calendar' };
  }

  try {
    const url = `https://graph.microsoft.com/v1.0/me/events/${eventId}`;

    // Build the update object
    const updateBody: any = {};

    if (updates.title !== undefined) {
      updateBody.subject = updates.title;
    }

    if (updates.startISO !== undefined && updates.endISO !== undefined) {
      // Parse timezone from ISO string
      const startDate = new Date(updates.startISO);
      const endDate = new Date(updates.endISO);

      updateBody.start = {
        dateTime: startDate.toISOString(),
        timeZone: 'UTC',
      };

      updateBody.end = {
        dateTime: endDate.toISOString(),
        timeZone: 'UTC',
      };
    }

    if (updates.description !== undefined) {
      updateBody.body = {
        contentType: 'text',
        content: updates.description,
      };
    }

    if (updates.location !== undefined) {
      updateBody.location = {
        displayName: updates.location,
      };
    }

    console.log('Modifying Outlook event:', eventId, updateBody);

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to modify Outlook event:', errorData);
      return {
        ok: false,
        error: errorData.error?.message || 'Failed to modify event',
      };
    }

    return { ok: true };
  } catch (error) {
    console.error('Error modifying Outlook Calendar event:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Install/update handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First install - open options page
    chrome.runtime.openOptionsPage();
  }
});
