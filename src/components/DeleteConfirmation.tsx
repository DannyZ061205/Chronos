import { usePopupStore } from '@/stores/popupStore';
import { formatDate, formatTime } from '@/utils/parser';

export function DeleteConfirmation() {
  const { selectedEvent, matchedEvents } = usePopupStore();

  if (!selectedEvent && matchedEvents.length === 0) {
    return null;
  }

  const eventToDelete = selectedEvent || matchedEvents[0];

  if (!eventToDelete) {
    return null;
  }

  const handleCancel = () => {
    usePopupStore.getState().reset();
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Event</h3>
          <p className="text-sm text-gray-600 mb-3">
            This feature is currently under development and will be available later this winter.
          </p>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-purple-900">
              📅 Selected Event: <span className="font-semibold">{eventToDelete.title}</span>
            </p>
            <p className="text-xs text-purple-700">
              {formatDate(eventToDelete.startISO, 'UTC')} at {formatTime(eventToDelete.startISO, 'UTC')}
            </p>
            <div className="mt-3 pt-3 border-t border-purple-200">
              <p className="text-xs text-purple-800 font-medium">
                ✨ Coming soon: Safe delete with full undo support
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
