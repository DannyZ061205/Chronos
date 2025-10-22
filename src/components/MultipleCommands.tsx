import { useState } from 'react';
import { usePopupStore } from '@/stores/popupStore';
import type { ParsedIntent } from '@/types';
import { searchEvents } from '@/utils/eventMatcher';

export function MultipleCommands() {
  const { multipleCommands, setEventDraft, setViewTimeframe, setMatchedEvents, setSelectedEvent, setUIState, accountStatus } = usePopupStore();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0); // Auto-expand first command

  if (!multipleCommands || multipleCommands.length === 0) {
    return null;
  }

  const handleBack = () => {
    setUIState('idle');
  };

  const renderCommandContent = (command: ParsedIntent, index: number) => {
    const isExpanded = expandedIndex === index;

    // Command header
    const getCommandTitle = (cmd: ParsedIntent) => {
      if (cmd.intent === 'create') {
        return `Create: ${cmd.draft.title}`;
      } else if (cmd.intent === 'view') {
        return `View: ${cmd.timeframe}`;
      } else if (cmd.intent === 'delete') {
        return `Delete: ${cmd.searchQuery}`;
      } else if (cmd.intent === 'modify') {
        return `Modify: ${cmd.searchQuery}`;
      }
      return 'Unknown command';
    };

    const getCommandIcon = (cmd: ParsedIntent) => {
      if (cmd.intent === 'create') {
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        );
      } else if (cmd.intent === 'view') {
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        );
      } else if (cmd.intent === 'delete') {
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        );
      } else if (cmd.intent === 'modify') {
        return (
          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      }
      return null;
    };

    const handleExecute = async (cmd: ParsedIntent) => {
      if (cmd.intent === 'create') {
        // Navigate to preview for this event
        setEventDraft(cmd.draft);
        setUIState('preview');
      } else if (cmd.intent === 'view') {
        // Navigate to view events
        setViewTimeframe({
          timeframe: cmd.timeframe,
          startISO: cmd.startISO || '',
          endISO: cmd.endISO || '',
        });
        setUIState('view_events');
      } else if (cmd.intent === 'delete') {
        // Fetch events and navigate to delete confirmation
        try {
          const eventsResponse = await chrome.runtime.sendMessage({
            type: 'LIST_EVENTS',
            payload: {
              maxResults: 100,
              sources: {
                google: accountStatus.google,
                outlook: accountStatus.outlook,
              },
            },
          });

          if (eventsResponse.ok) {
            const matched = searchEvents(eventsResponse.events, cmd.searchQuery);
            setMatchedEvents(matched);
            setSelectedEvent(matched[0] || null);

            if (matched.length > 0) {
              setUIState('delete_confirm');
            } else {
              usePopupStore.getState().showToast({
                type: 'error',
                message: 'No matching events found',
              });
            }
          }
        } catch (error) {
          console.error('Error fetching events for delete:', error);
        }
      } else if (cmd.intent === 'modify') {
        // Fetch events and navigate to modify form
        try {
          const eventsResponse = await chrome.runtime.sendMessage({
            type: 'LIST_EVENTS',
            payload: {
              maxResults: 100,
              sources: {
                google: accountStatus.google,
                outlook: accountStatus.outlook,
              },
            },
          });

          if (eventsResponse.ok) {
            const matched = searchEvents(eventsResponse.events, cmd.searchQuery);
            setMatchedEvents(matched);
            setSelectedEvent(matched[0] || null);

            if (matched.length > 0) {
              setUIState('modify_form');
            } else {
              usePopupStore.getState().showToast({
                type: 'error',
                message: 'No matching events found',
              });
            }
          }
        } catch (error) {
          console.error('Error fetching events for modify:', error);
        }
      }
    };

    return (
      <div key={index} className="border border-gray-300 rounded-lg overflow-hidden">
        <button
          onClick={() => setExpandedIndex(isExpanded ? null : index)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            {getCommandIcon(command)}
            <span className="font-medium text-gray-900">{getCommandTitle(command)}</span>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="p-4 bg-white border-t border-gray-200">
            {command.intent === 'create' && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <p><strong>Event:</strong> {command.draft.title}</p>
                  <p><strong>Time:</strong> {new Date(command.draft.startISO).toLocaleString()}</p>
                  <p><strong>Duration:</strong> {Math.round((new Date(command.draft.endISO).getTime() - new Date(command.draft.startISO).getTime()) / 60000)} minutes</p>
                </div>
                <button
                  onClick={() => handleExecute(command)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Review & Create
                </button>
              </div>
            )}

            {command.intent === 'view' && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <p>View your events for <strong>{command.timeframe}</strong></p>
                </div>
                <button
                  onClick={() => handleExecute(command)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  View Events
                </button>
              </div>
            )}

            {command.intent === 'delete' && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <p>Delete events matching: <strong>{command.searchQuery}</strong></p>
                </div>
                <button
                  onClick={() => handleExecute(command)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Find & Delete
                </button>
              </div>
            )}

            {command.intent === 'modify' && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <p>Modify events matching: <strong>{command.searchQuery}</strong></p>
                </div>
                <button
                  onClick={() => handleExecute(command)}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Find & Modify
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg text-gray-900">
          Multiple Commands ({multipleCommands.length})
        </h3>
        <button
          onClick={handleBack}
          className="text-purple-600 hover:text-purple-700 text-sm font-medium"
        >
          Back
        </button>
      </div>

      <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded p-3">
        <p>Your input contains multiple commands. Review and execute them one by one:</p>
      </div>

      <div className="space-y-2">
        {multipleCommands.map((command, index) => renderCommandContent(command, index))}
      </div>
    </div>
  );
}
