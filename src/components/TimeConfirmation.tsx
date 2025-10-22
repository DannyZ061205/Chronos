import { useState } from 'react';
import { usePopupStore } from '@/stores/popupStore';
import { DateTime } from 'luxon';

export function TimeConfirmation() {
  const { eventDraft, setEventDraft, setUIState } = usePopupStore();
  const [timeInput, setTimeInput] = useState('');
  const [error, setError] = useState('');

  if (!eventDraft) return null;

  const handleTimeSubmit = () => {
    if (!timeInput.trim()) {
      setError('Please enter a time');
      return;
    }

    try {
      // Parse the time input (simple format like "3pm", "15:00", "9:30am")
      const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
      const match = timeInput.trim().toLowerCase().match(timeRegex);

      if (!match) {
        setError('Invalid time format. Try "3pm", "15:00", or "9:30am"');
        return;
      }

      let hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const meridiem = match[3];

      // Convert to 24-hour format
      if (meridiem === 'pm' && hours !== 12) {
        hours += 12;
      } else if (meridiem === 'am' && hours === 12) {
        hours = 0;
      }

      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        setError('Invalid time. Hours must be 0-23, minutes 0-59');
        return;
      }

      // Update the event draft with the new time
      const currentStart = DateTime.fromISO(eventDraft.startISO);
      const newStart = currentStart.set({ hour: hours, minute: minutes });

      // Calculate duration
      const currentEnd = DateTime.fromISO(eventDraft.endISO);
      const duration = currentEnd.diff(currentStart, 'minutes').minutes;
      const newEnd = newStart.plus({ minutes: duration });

      setEventDraft({
        ...eventDraft,
        startISO: newStart.toISO()!,
        endISO: newEnd.toISO()!,
        needsTimeConfirmation: false,
      });

      // Check if duration confirmation is needed
      if (eventDraft.needsDurationConfirmation) {
        setUIState('duration_confirmation');
      } else {
        setUIState('preview');
      }
    } catch (err) {
      setError('Failed to parse time. Please try again.');
    }
  };

  const handleCancel = () => {
    setUIState('idle');
    setEventDraft(null);
  };

  return (
    <div className="card">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">What time?</h3>
        <p className="text-xs text-gray-600">
          You didn't specify a time for "<span className="font-medium">{eventDraft.title}</span>". Please enter the time:
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <input
            type="text"
            value={timeInput}
            onChange={(e) => {
              setTimeInput(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTimeSubmit();
              }
            }}
            placeholder="e.g., 3pm, 15:00, 9:30am"
            className="input"
            autoFocus
          />
          {error && (
            <p className="text-xs text-red-600 mt-1">{error}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Examples: "3pm", "15:00", "9:30am"
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={handleTimeSubmit} className="btn-primary flex-1">
            Continue
          </button>
          <button onClick={handleCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
