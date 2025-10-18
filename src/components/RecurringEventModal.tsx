import { useState } from 'react';

export type RecurrenceScope = 'this' | 'following' | 'all';

interface RecurringEventModalProps {
  action: 'delete' | 'modify';
  eventTitle: string;
  onSelect: (scope: RecurrenceScope) => void;
  onCancel: () => void;
}

export function RecurringEventModal({ action, onSelect, onCancel }: RecurringEventModalProps) {
  const [selectedScope, setSelectedScope] = useState<RecurrenceScope>('this');
  const actionText = action === 'delete' ? 'Delete' : 'Modify';

  const handleOk = () => {
    onSelect(selectedScope);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          {actionText} recurring event
        </h3>

        <div className="space-y-4 mb-6">
          {/* This event */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="flex items-center h-6">
              <input
                type="radio"
                name="recurrence-scope"
                value="this"
                checked={selectedScope === 'this'}
                onChange={() => setSelectedScope('this')}
                className="w-5 h-5 text-purple-600 border-gray-300 focus:ring-purple-500"
              />
            </div>
            <div className="flex-1">
              <div className="text-base font-normal text-gray-900">This event</div>
            </div>
          </label>

          {/* This and following events */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="flex items-center h-6">
              <input
                type="radio"
                name="recurrence-scope"
                value="following"
                checked={selectedScope === 'following'}
                onChange={() => setSelectedScope('following')}
                className="w-5 h-5 text-purple-600 border-gray-300 focus:ring-purple-500"
              />
            </div>
            <div className="flex-1">
              <div className="text-base font-normal text-gray-900">This and following events</div>
            </div>
          </label>

          {/* All events */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="flex items-center h-6">
              <input
                type="radio"
                name="recurrence-scope"
                value="all"
                checked={selectedScope === 'all'}
                onChange={() => setSelectedScope('all')}
                className="w-5 h-5 text-purple-600 border-gray-300 focus:ring-purple-500"
              />
            </div>
            <div className="flex-1">
              <div className="text-base font-normal text-gray-900">All events</div>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleOk}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
