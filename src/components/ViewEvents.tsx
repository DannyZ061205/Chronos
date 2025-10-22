import { useState, useEffect } from 'react';
import { usePopupStore } from '@/stores/popupStore';
import type { CalendarEvent, ListEventsRequest, ListEventsResponse } from '@/types';
import { formatDateTime } from '@/utils/parser';
import { DateTime } from 'luxon';

interface ViewEventsProps {
  timeframe: string;
  startISO: string;
  endISO: string;
}

export function ViewEvents({ timeframe, startISO, endISO }: ViewEventsProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { accountStatus } = usePopupStore();

  useEffect(() => {
    loadEvents();
  }, [startISO, endISO]);

  const loadEvents = async () => {
    setLoading(true);
    setError('');

    try {
      const request: ListEventsRequest = {
        type: 'LIST_EVENTS',
        payload: {
          maxResults: 100,
          sources: {
            google: accountStatus.google,
            outlook: accountStatus.outlook
          },
        },
      };

      const response = await chrome.runtime.sendMessage(request) as ListEventsResponse;

      if (response.ok) {
        // Filter events to the specified timeframe
        const start = DateTime.fromISO(startISO);
        const end = DateTime.fromISO(endISO);

        const filtered = response.events.filter((event) => {
          const eventStart = DateTime.fromISO(event.startISO);
          return eventStart >= start && eventStart <= end;
        });

        // Sort by start time
        filtered.sort((a, b) => {
          return DateTime.fromISO(a.startISO).toMillis() - DateTime.fromISO(b.startISO).toMillis();
        });

        setEvents(filtered);
      } else {
        setError(response.error || 'Failed to load events');
      }
    } catch (err) {
      setError('Failed to load events');
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    // Extract date from the event's startISO
    const eventDate = new Date(event.startISO);
    const year = eventDate.getFullYear();
    const month = eventDate.getMonth() + 1; // Months are 0-indexed
    const day = eventDate.getDate();

    let url: string;

    if (event.source === 'google') {
      // Google Calendar URL format
      url = `https://calendar.google.com/calendar/u/0/r/day/${year}/${month}/${day}`;
    } else {
      // Outlook Calendar URL format
      url = `https://outlook.office.com/calendar/view/day/${year}/${month}/${day}`;
    }

    chrome.tabs.create({ url });
  };

  return (
    <div className="p-4 space-y-3">
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-gray-600 mt-2">Loading events...</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="p-8 bg-gray-50 border border-gray-200 rounded text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-gray-600">No events found for {timeframe}</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.map((event) => (
            <div
              key={`${event.source}-${event.id}`}
              onClick={() => handleEventClick(event)}
              className="p-3 bg-gray-50 rounded border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">
                    {event.title}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {formatDateTime(event.startISO, Intl.DateTimeFormat().resolvedOptions().timeZone)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      event.source === 'google'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {event.source === 'google' ? 'Google' : 'Outlook'}
                    </span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
          Showing {events.length} event{events.length === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}
