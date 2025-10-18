import { useState, useEffect } from 'react';
import type { CalendarEvent, ListEventsRequest, ListEventsResponse, DeleteEventRequest, DeleteEventResponse } from '@/types';
import { formatDateTime } from '@/utils/parser';

export function EventsList() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isExpanded) {
      loadEvents();
    }
  }, [isExpanded]);

  const loadEvents = async () => {
    setLoading(true);
    setError('');

    try {
      const request: ListEventsRequest = {
        type: 'LIST_EVENTS',
        payload: {
          maxResults: 10,
          sources: { google: true, outlook: true },
        },
      };

      const response = await chrome.runtime.sendMessage(request) as ListEventsResponse;

      if (response.ok) {
        setEvents(response.events);
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

  const handleDelete = async (event: CalendarEvent) => {
    if (!confirm(`Delete "${event.title}"?`)) return;

    try {
      const request: DeleteEventRequest = {
        type: 'DELETE_EVENT',
        payload: {
          eventId: event.id,
          source: event.source,
        },
      };

      const response = await chrome.runtime.sendMessage(request) as DeleteEventResponse;

      if (response.ok) {
        // Remove from list
        setEvents(events.filter(e => e.id !== event.id));
      } else {
        alert(`Failed to delete event: ${response.error}`);
      }
    } catch (err) {
      alert('Failed to delete event');
      console.error('Error deleting event:', err);
    }
  };

  return (
    <div className="border-t border-gray-200 pt-3 mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <span className="font-medium">Upcoming Events</span>
        <div className="flex items-center gap-2">
          {isExpanded && !loading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                loadEvents();
              }}
              className="text-purple-600 hover:text-purple-700 text-xs"
            >
              Refresh
            </button>
          )}
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-2">
          {loading && (
            <div className="text-center py-4">
              <div className="animate-spin h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full mx-auto" />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              {error}
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600 text-center">
              No upcoming events
            </div>
          )}

          {!loading && events.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {events.map((event) => (
                <div
                  key={`${event.source}-${event.id}`}
                  className="p-3 bg-gray-50 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">
                        {event.title}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {formatDateTime(event.startISO, Intl.DateTimeFormat().resolvedOptions().timeZone)}
                      </div>
                      {event.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {event.description}
                        </div>
                      )}
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
                    <button
                      onClick={() => handleDelete(event)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete event"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
