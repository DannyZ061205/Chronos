import { usePopupStore } from '@/stores/popupStore';

export function TargetToggles() {
  const { targets, toggleGoogle, toggleOutlook, accountStatus, uiState } = usePopupStore();
  
  const disabled = uiState === 'submitting';
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Add to calendars:</label>
      
      <div className="flex gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={targets.google}
            onChange={toggleGoogle}
            disabled={!accountStatus.google || disabled}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className={`text-sm ${!accountStatus.google ? 'text-gray-400' : 'text-gray-700'}`}>
            Google Calendar
            {!accountStatus.google && (
              <span className="ml-1 text-xs text-red-600">(not connected)</span>
            )}
          </span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={targets.outlook}
            onChange={toggleOutlook}
            disabled={!accountStatus.outlook || disabled}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className={`text-sm ${!accountStatus.outlook ? 'text-gray-400' : 'text-gray-700'}`}>
            Outlook Calendar
            {!accountStatus.outlook && (
              <span className="ml-1 text-xs text-red-600">(not connected)</span>
            )}
          </span>
        </label>
      </div>
      
      {!accountStatus.google && !accountStatus.outlook && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
          Please connect at least one calendar in Settings
        </p>
      )}
    </div>
  );
}
