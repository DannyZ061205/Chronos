import { usePopupStore } from '@/stores/popupStore';
import { formatDate, formatTime, getDurationString } from '@/utils/parser';

export function PreviewCard() {
  const {
    eventDraft,
    uiState,
    setUIState,
    multipleEventDrafts,
    currentEventIndex,
    setCurrentEventIndex,
    setEventDraft,
    setMultipleEventDrafts,
    showToast,
    reset,
  } = usePopupStore();

  if (!eventDraft || (uiState !== 'preview' && uiState !== 'submitting')) {
    return null;
  }

  const { title, startISO, endISO, tz, description, recurrence } = eventDraft;
  const hasMultipleEvents = multipleEventDrafts.length > 0;

  const handlePrevious = () => {
    if (currentEventIndex > 0) {
      const newIndex = currentEventIndex - 1;
      setCurrentEventIndex(newIndex);
      setEventDraft(multipleEventDrafts[newIndex]);
    }
  };

  const handleNext = () => {
    if (currentEventIndex < multipleEventDrafts.length - 1) {
      const newIndex = currentEventIndex + 1;
      setCurrentEventIndex(newIndex);
      setEventDraft(multipleEventDrafts[newIndex]);
    }
  };

  const handleDelete = () => {
    // Delete the current event from the list
    if (hasMultipleEvents) {
      const updatedDrafts = multipleEventDrafts.filter((_, index) => index !== currentEventIndex);
      setMultipleEventDrafts(updatedDrafts);

      if (updatedDrafts.length === 0) {
        // No more events - reset
        showToast({
          type: 'info',
          message: '🗑️ All events deleted.',
        });
        reset();
      } else if (currentEventIndex >= updatedDrafts.length) {
        // Was on last event - show previous event
        const newIndex = updatedDrafts.length - 1;
        setCurrentEventIndex(newIndex);
        setEventDraft(updatedDrafts[newIndex]);

        showToast({
          type: 'info',
          message: `🗑️ Event deleted. ${updatedDrafts.length} event${updatedDrafts.length === 1 ? '' : 's'} remaining.`,
        });
      } else {
        // Show event at same index (which is now the next event)
        setEventDraft(updatedDrafts[currentEventIndex]);

        showToast({
          type: 'info',
          message: `🗑️ Event deleted. ${updatedDrafts.length} event${updatedDrafts.length === 1 ? '' : 's'} remaining.`,
        });
      }
    }
  };

  // Parse recurrence pattern to display text
  const getRecurrenceText = (rrule?: string): string | null => {
    if (!rrule) return null;

    const freqMatch = rrule.match(/FREQ=(\w+)/);
    if (!freqMatch) return null;

    const freq = freqMatch[1];

    // Check for INTERVAL first
    const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
    const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;

    // Check for BYDAY parameter
    const byDayMatch = rrule.match(/BYDAY=([A-Z,]+)/);
    if (byDayMatch) {
      const days = byDayMatch[1].split(',');
      const dayMap: Record<string, string> = {
        'MO': 'Mon',
        'TU': 'Tue',
        'WE': 'Wed',
        'TH': 'Thu',
        'FR': 'Fri',
        'SA': 'Sat',
        'SU': 'Sun'
      };

      // Special cases for common patterns (without interval)
      if (interval === 1) {
        const daySet = days.sort().join(',');
        if (daySet === 'SA,SU') {
          return 'Weekends';
        }
        if (daySet === 'FR,MO,TH,TU,WE') {
          return 'Weekdays';
        }
      }

      const dayNames = days.map(d => dayMap[d] || d).join(', ');

      // Handle intervals with specific days
      if (interval === 2) {
        return `Every 2 weeks: ${dayNames}`;
      } else if (interval > 2) {
        return `Every ${interval} weeks: ${dayNames}`;
      } else {
        return `Weekly: ${dayNames}`;
      }
    }

    // No BYDAY - just check interval
    if (interval > 1) {
      if (freq === 'WEEKLY') {
        return `Every ${interval} weeks`;
      }
      if (freq === 'DAILY') {
        return `Every ${interval} days`;
      }
    }

    const freqMap: Record<string, string> = {
      'DAILY': 'Daily',
      'WEEKLY': 'Weekly',
      'MONTHLY': 'Monthly',
      'YEARLY': 'Yearly'
    };

    return freqMap[freq] || freq;
  };

  const recurrenceText = getRecurrenceText(recurrence);
  
  return (
    <div className="card space-y-3">
      {hasMultipleEvents && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              📅 Event {currentEventIndex + 1} of {multipleEventDrafts.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={uiState === 'submitting'}
                className="p-1 rounded hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                aria-label="Delete this event"
                title="Delete this event"
              >
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={handlePrevious}
                disabled={currentEventIndex === 0 || uiState === 'submitting'}
                className="p-1 rounded hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                aria-label="Previous event"
                title="Previous event"
              >
                <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleNext}
                disabled={currentEventIndex === multipleEventDrafts.length - 1 || uiState === 'submitting'}
                className="p-1 rounded hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                aria-label="Next event"
                title="Next event"
              >
                <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-lg text-gray-900">{title}</h3>
        <button
          onClick={() => setUIState('editing')}
          disabled={uiState === 'submitting'}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
          aria-label="Edit event details"
        >
          Edit
        </button>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="font-medium text-gray-900">
              {formatDate(startISO, tz)}
              {recurrenceText && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {recurrenceText}
                </span>
              )}
            </p>
            <p className="text-gray-600">
              {formatTime(startISO, tz)} - {formatTime(endISO, tz)}
              <span className="ml-2 text-gray-500">
                ({getDurationString(startISO, endISO)})
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-600">{tz}</p>
        </div>

        {description && (
          <div className="flex items-start gap-2 pt-2 border-t border-gray-200">
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
              <p className="text-gray-700 text-sm">{description}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
