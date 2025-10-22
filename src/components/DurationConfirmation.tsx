import { useState } from 'react';
import { usePopupStore } from '@/stores/popupStore';
import { DateTime } from 'luxon';

export function DurationConfirmation() {
  const { eventDraft, setEventDraft, setUIState } = usePopupStore();
  const [durationInput, setDurationInput] = useState(
    eventDraft?.suggestedDurationMinutes?.toString() || '60'
  );
  const [error, setError] = useState('');

  if (!eventDraft) return null;

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minutes`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    return `${hours}h ${mins}m`;
  };

  const handleDurationSubmit = () => {
    if (!durationInput.trim()) {
      setError('Please enter a duration');
      return;
    }

    try {
      const minutes = parseInt(durationInput);

      if (isNaN(minutes) || minutes <= 0) {
        setError('Please enter a valid number of minutes');
        return;
      }

      if (minutes > 1440) {
        setError('Duration cannot exceed 24 hours (1440 minutes)');
        return;
      }

      // Update the event draft with the confirmed duration
      const startTime = DateTime.fromISO(eventDraft.startISO);
      const newEndTime = startTime.plus({ minutes });

      setEventDraft({
        ...eventDraft,
        endISO: newEndTime.toISO()!,
        needsDurationConfirmation: false,
      });

      setUIState('preview');
    } catch (err) {
      setError('Failed to parse duration. Please try again.');
    }
  };

  const handleCancel = () => {
    setUIState('idle');
    setEventDraft(null);
  };

  const suggestedMinutes = eventDraft.suggestedDurationMinutes || 60;

  return (
    <div className="card">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">How long will this last?</h3>
        <p className="text-xs text-gray-600">
          Event: "<span className="font-medium">{eventDraft.title}</span>"
        </p>
        <p className="text-xs text-purple-600 mt-1">
          Suggested: {formatDuration(suggestedMinutes)}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-700 mb-1 block">
            Duration (minutes)
          </label>
          <input
            type="number"
            value={durationInput}
            onChange={(e) => {
              setDurationInput(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleDurationSubmit();
              }
            }}
            placeholder="e.g., 60, 90, 180"
            className="input"
            autoFocus
            min="1"
            max="1440"
          />
          {error && (
            <p className="text-xs text-red-600 mt-1">{error}</p>
          )}
          {!error && durationInput && parseInt(durationInput) > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              = {formatDuration(parseInt(durationInput))}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={handleDurationSubmit} className="btn-primary flex-1">
            Confirm
          </button>
          <button onClick={handleCancel} className="btn-secondary">
            Cancel
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setDurationInput('15')}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
          >
            15 min
          </button>
          <button
            onClick={() => setDurationInput('30')}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
          >
            30 min
          </button>
          <button
            onClick={() => setDurationInput('60')}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
          >
            1 hour
          </button>
          <button
            onClick={() => setDurationInput('90')}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
          >
            1.5 hours
          </button>
          <button
            onClick={() => setDurationInput('120')}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
          >
            2 hours
          </button>
          <button
            onClick={() => setDurationInput('180')}
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
          >
            3 hours
          </button>
        </div>
      </div>
    </div>
  );
}
