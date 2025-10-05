import { useState } from 'react';
import { usePopupStore } from '@/stores/popupStore';
import { useActionHistoryStore } from '@/stores/actionHistoryStore';
import { DateTime } from 'luxon';
import { formatDate, formatTime } from '@/utils/parser';
import type { ModifyEventRequest, RecurrenceScope } from '@/types';

export function ModifyForm() {
  const { parsedIntent, selectedEvent, showToast, reset } = usePopupStore();
  const { addAction } = useActionHistoryStore();
  const [isModifying, setIsModifying] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  if (!parsedIntent || parsedIntent.intent !== 'modify' || !selectedEvent) {
    return null;
  }

  const handleCancel = () => {
    reset();
  };

  // Parse the requested changes and apply them to the event
  const applyChanges = () => {
    const changes = parsedIntent.changes || {};
    const updates: ModifyEventRequest['payload']['updates'] = {};

    // Parse time changes (e.g., {"time": "10am"})
    if (changes.time) {
      // Get user's local timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Parse original times in user's timezone
      const originalStart = DateTime.fromISO(selectedEvent.startISO).setZone(userTimezone);
      const originalEnd = DateTime.fromISO(selectedEvent.endISO).setZone(userTimezone);
      const duration = originalEnd.diff(originalStart);

      // Parse the new time
      const timeStr = changes.time.toLowerCase();
      let hour = 0;
      let minute = 0;

      if (timeStr.includes('am') || timeStr.includes('pm')) {
        const isPM = timeStr.includes('pm');
        const timeNum = parseInt(timeStr.replace(/[^\d]/g, ''));
        hour = isPM && timeNum !== 12 ? timeNum + 12 : (timeNum === 12 && !isPM ? 0 : timeNum);
      } else {
        hour = parseInt(timeStr.replace(/[^\d]/g, ''));
      }

      // Create new start time with same date but new time IN USER'S TIMEZONE
      const newStart = originalStart.set({ hour, minute, second: 0, millisecond: 0 });
      const newEnd = newStart.plus(duration);

      // Convert back to ISO with timezone
      updates.startISO = newStart.toISO()!;
      updates.endISO = newEnd.toISO()!;
    }

    // Parse date changes (e.g., {"date": "tomorrow"})
    if (changes.date) {
      // Get user's local timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Parse original times in user's timezone
      const originalStart = DateTime.fromISO(selectedEvent.startISO).setZone(userTimezone);
      const originalEnd = DateTime.fromISO(selectedEvent.endISO).setZone(userTimezone);
      const duration = originalEnd.diff(originalStart);

      let newStart = originalStart;

      const dateStr = changes.date.toLowerCase();
      if (dateStr === 'tomorrow') {
        newStart = originalStart.plus({ days: 1 });
      } else if (dateStr === 'today') {
        newStart = DateTime.now().setZone(userTimezone).set({
          hour: originalStart.hour,
          minute: originalStart.minute
        });
      } else {
        // Try parsing as a date
        try {
          const parsed = DateTime.fromISO(dateStr).setZone(userTimezone);
          if (parsed.isValid) {
            newStart = parsed.set({
              hour: originalStart.hour,
              minute: originalStart.minute
            });
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      const newEnd = newStart.plus(duration);
      updates.startISO = newStart.toISO()!;
      updates.endISO = newEnd.toISO()!;
    }

    // Title changes
    if (changes.title) {
      updates.title = changes.title;
    }

    return updates;
  };

  const updates = applyChanges();

  const getUpdatedEventPreview = () => {
    const newEvent = { ...selectedEvent };

    if (updates.startISO) {
      newEvent.startISO = updates.startISO;
    }
    if (updates.endISO) {
      newEvent.endISO = updates.endISO;
    }
    if (updates.title) {
      newEvent.title = updates.title;
    }

    return newEvent;
  };

  const updatedEvent = getUpdatedEventPreview();
  const isRecurring = selectedEvent.recurrence !== undefined && selectedEvent.recurrence !== null;

  // Get user's local timezone for display
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleConfirmModify = async (recurringScope?: RecurrenceScope) => {
    setIsModifying(true);

    try {
      const request: ModifyEventRequest = {
        type: 'MODIFY_EVENT',
        payload: {
          eventId: selectedEvent.id,
          source: selectedEvent.source,
          updates,
          recurringScope,
        },
      };

      const response = await chrome.runtime.sendMessage(request);

      if (response.ok) {
        // Add to action history
        addAction({
          type: 'modify',
          modifiedEvent: [{
            eventId: selectedEvent.id,
            source: selectedEvent.source,
            before: selectedEvent,
            after: updatedEvent,
          }],
        });

        showToast({
          type: 'success',
          message: '✓ Event modified successfully!',
        });

        setTimeout(() => {
          reset();
        }, 1500);
      } else {
        showToast({
          type: 'error',
          message: `Failed to modify event: ${response.error}`,
        });
      }
    } catch (error) {
      console.error('Error modifying event:', error);
      showToast({
        type: 'error',
        message: 'Failed to modify event. Please try again.',
      });
    } finally {
      setIsModifying(false);
    }
  };

  const handleModify = () => {
    if (isRecurring) {
      setShowRecurringModal(true);
    } else {
      handleConfirmModify();
    }
  };

  return (
    <>
      <div className="card space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Modify Event</h3>
            {isRecurring && (
              <div className="mb-2 text-sm text-blue-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Recurring event
              </div>
            )}

            {/* Current Event */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Current</p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="font-medium text-gray-900">{selectedEvent.title}</p>
                <p className="text-sm text-gray-600">
                  {formatDate(selectedEvent.startISO, userTimezone)} at {formatTime(selectedEvent.startISO, userTimezone)}
                </p>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>

            {/* Updated Event */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">After Changes</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                <p className="font-medium text-gray-900">{updatedEvent.title}</p>
                <p className="text-sm text-gray-600">
                  {formatDate(updatedEvent.startISO, userTimezone)} at {formatTime(updatedEvent.startISO, userTimezone)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleModify}
            disabled={isModifying}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isModifying ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Modifying...
              </span>
            ) : (
              'Confirm Changes'
            )}
          </button>

          <button
            onClick={handleCancel}
            disabled={isModifying}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Recurring Modal - placeholder for now */}
      {showRecurringModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Modify recurring event
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              This is a recurring event. How would you like to apply the changes?
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => {
                  setShowRecurringModal(false);
                  handleConfirmModify('this');
                }}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">This event only</div>
                <div className="text-sm text-gray-500">Only modify this occurrence</div>
              </button>

              <button
                onClick={() => {
                  setShowRecurringModal(false);
                  handleConfirmModify('all');
                }}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">All events</div>
                <div className="text-sm text-gray-500">Modify all occurrences in the series</div>
              </button>
            </div>

            <button
              onClick={() => setShowRecurringModal(false)}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
