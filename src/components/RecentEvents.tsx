import { useState, useEffect } from 'react';
import { getRecentEvents, type RecentEvent } from '@/utils/storage';
import { formatDateTime } from '@/utils/parser';

export function RecentEvents() {
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadRecentEvents();
  }, []);

  const loadRecentEvents = async () => {
    const events = await getRecentEvents();
    setRecentEvents(events);
  };

  if (recentEvents.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 pt-3 mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <span className="font-medium">Recent Events ({recentEvents.length})</span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {recentEvents.map((event, index) => (
            <div
              key={index}
              className="p-2 bg-gray-50 rounded border border-gray-200 text-xs"
            >
              <div className="font-semibold text-gray-900">{event.title}</div>
              <div className="text-gray-600 mt-1">
                {formatDateTime(event.startISO, event.tz)}
              </div>
              {event.description && (
                <div className="text-gray-500 mt-1 italic line-clamp-2">
                  {event.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
