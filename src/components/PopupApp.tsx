import { useEffect } from 'react';
import { usePopupStore } from '@/stores/popupStore';
import { useActionHistoryStore } from '@/stores/actionHistoryStore';
import { CommandInput } from './CommandInput';
import { PreviewCard } from './PreviewCard';
import { EditForm } from './EditForm';
import { TargetToggles } from './TargetToggles';
import { ActionButtons } from './ActionButtons';
import { Toast } from './Toast';
import { EventsList } from './EventsList';
import { DeleteConfirmation } from './DeleteConfirmation';
import { ModifyForm } from './ModifyForm';
import { UndoRedoButtons } from './UndoRedoButtons';
import { TimeConfirmation } from './TimeConfirmation';
import { DurationConfirmation } from './DurationConfirmation';
import { ViewEvents } from './ViewEvents';
import { MultipleCommands } from './MultipleCommands';

export function PopupApp() {
  const { setAccountStatus, uiState, accountStatus, viewTimeframe } = usePopupStore();
  const { loadFromStorage } = useActionHistoryStore();

  // Check account status and load action history on mount
  useEffect(() => {
    checkAccountStatus();
    loadFromStorage();
  }, [loadFromStorage]);
  
  const checkAccountStatus = async () => {
    try {
      // Check Google Calendar connection
      const googleToken = await chrome.identity.getAuthToken({ 
        interactive: false 
      }).catch(() => null);
      
      // For Outlook, we'll check in the service worker
      // For now, we'll get status from storage
      const status = await chrome.storage.local.get(['googleConnected', 'outlookConnected']);
      
      setAccountStatus({
        google: !!googleToken || status.googleConnected || false,
        outlook: status.outlookConnected || false,
      });
    } catch (error) {
      console.error('Error checking account status:', error);
      setAccountStatus({ google: false, outlook: false });
    }
  };
  
  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
  };
  
  return (
    <div className="w-[384px] bg-white" role="dialog" aria-label="Chronos popup">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <img src="/logo.jpg" alt="Chronos AI" className="h-8" />
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Status Indicators */}
          <div className="relative flex items-end gap-1.5">
            <div
              className={`relative w-5 h-5 rounded overflow-hidden ${!accountStatus.google && 'opacity-40'}`}
              title={accountStatus.google ? 'Google Calendar connected' : 'Google Calendar not connected'}
            >
              <img src="/logos/google-calendar.jpg" alt="Google" className="w-full h-full object-cover" />
            </div>
            <div
              className={`relative w-5 h-5 rounded overflow-hidden -translate-y-[5px] ${!accountStatus.outlook && 'opacity-40'}`}
              title={accountStatus.outlook ? 'Outlook Calendar connected' : 'Outlook Calendar not connected'}
            >
              <img src="/logos/outlook-calendar.png" alt="Outlook" className="w-full h-full object-cover" />
            </div>
            {/* Green dots positioned absolutely at the same level */}
            {accountStatus.google && (
              <div className="absolute bottom-0 left-[14px] w-2 h-2 bg-green-400 rounded-full border border-white" />
            )}
            {accountStatus.outlook && (
              <div className="absolute bottom-0 left-[38px] w-2 h-2 bg-green-400 rounded-full border border-white" />
            )}
          </div>

          <UndoRedoButtons />
          <button
            onClick={handleOpenSettings}
            className="p-1 hover:bg-purple-500 rounded transition-colors"
            aria-label="Open settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Command Input */}
        <CommandInput />

        {/* Time Confirmation */}
        {uiState === 'time_confirmation' && <TimeConfirmation />}

        {/* Duration Confirmation */}
        {uiState === 'duration_confirmation' && <DurationConfirmation />}

        {/* Delete Confirmation */}
        {uiState === 'delete_confirm' && <DeleteConfirmation />}

        {/* Modify Form */}
        {uiState === 'modify_form' && <ModifyForm />}

        {/* View Events */}
        {uiState === 'view_events' && viewTimeframe && (
          <ViewEvents
            timeframe={viewTimeframe.timeframe}
            startISO={viewTimeframe.startISO}
            endISO={viewTimeframe.endISO}
          />
        )}

        {/* Multiple Commands */}
        {uiState === 'multiple_commands' && <MultipleCommands />}

        {/* Preview or Edit Form */}
        {uiState === 'editing' ? <EditForm /> : <PreviewCard />}

        {/* Target Toggles - show when preview is active */}
        {(uiState === 'preview' || uiState === 'submitting') && <TargetToggles />}

        {/* Action Buttons */}
        <ActionButtons />

        {/* Helpful hint when idle */}
        {uiState === 'idle' && !usePopupStore.getState().inputText && (
          <div className="text-sm text-gray-500 bg-gray-50 rounded p-3 border border-gray-200">
            <p className="font-medium mb-1">Examples:</p>
            <ul className="space-y-1 text-xs">
              <li>• "Team sync tomorrow 2pm 30m"</li>
              <li>• "Lunch Friday at noon for an hour"</li>
              <li>• "Workshop next Monday 3-5pm"</li>
            </ul>
          </div>
        )}

        {/* Upcoming Events List */}
        <EventsList />
      </div>
      
      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}
