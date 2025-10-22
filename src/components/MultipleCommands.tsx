import { useState } from 'react';
import { usePopupStore } from '@/stores/popupStore';
import type { ParsedIntent } from '@/types';
import { ViewEvents } from './ViewEvents';
import { formatDateTime } from '@/utils/parser';

export function MultipleCommands() {
  const { multipleCommands, setEventDraft, setUIState } = usePopupStore();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0); // Auto-expand first command

  if (!multipleCommands || multipleCommands.length === 0) {
    return null;
  }


  const handleToggle = (index: number, command: ParsedIntent) => {
    const newExpanded = expandedIndex === index ? null : index;
    setExpandedIndex(newExpanded);

    // If expanding a CREATE command, set it as the event draft
    if (newExpanded === index && command.intent === 'create') {
      setEventDraft(command.draft);
    }
  };

  const handleExecuteCommand = (command: ParsedIntent) => {
    if (command.intent === 'create') {
      // Already set as draft, just navigate to preview
      setEventDraft(command.draft);
      setUIState('preview');
    } else if (command.intent === 'view') {
      // Already showing in ViewEvents, this shouldn't be needed
    } else if (command.intent === 'delete' || command.intent === 'modify') {
      // These need special handling - navigate to their respective states
      // For now, just set the draft and change UI
      if (command.intent === 'delete') {
        setUIState('delete_confirm');
      } else {
        setUIState('modify_form');
      }
    }
  };

  const renderCommandContent = (command: ParsedIntent, index: number) => {
    const isExpanded = expandedIndex === index;

    const getCommandTitle = (cmd: ParsedIntent) => {
      if (cmd.intent === 'create') {
        return cmd.draft.title;
      } else if (cmd.intent === 'view') {
        return `Events for ${cmd.timeframe}`;
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
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        );
      } else if (cmd.intent === 'view') {
        return (
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        );
      } else if (cmd.intent === 'delete') {
        return (
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        );
      } else if (cmd.intent === 'modify') {
        return (
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      }
      return null;
    };

    return (
      <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => handleToggle(index, command)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-purple-50 transition-colors"
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
          <div className="border-t border-gray-200">
            {command.intent === 'create' && (
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{command.draft.title}</h4>
                  <button
                    onClick={() => {
                      setEventDraft(command.draft);
                      setUIState('editing');
                    }}
                    className="text-purple-600 hover:text-purple-700 text-sm font-medium"
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
                        {formatDateTime(command.draft.startISO, command.draft.tz)}
                      </p>
                      <p className="text-gray-600">
                        {new Date(command.draft.startISO).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(command.draft.endISO).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        <span className="ml-2 text-gray-500">
                          ({Math.round((new Date(command.draft.endISO).getTime() - new Date(command.draft.startISO).getTime()) / 60000)}m)
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-600">{command.draft.tz}</p>
                  </div>

                  {command.draft.reminderMinutes !== undefined && command.draft.reminderMinutes > 0 && (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <p className="text-gray-600">
                        {command.draft.reminderMinutes >= 60
                          ? `${Math.floor(command.draft.reminderMinutes / 60)} hour${Math.floor(command.draft.reminderMinutes / 60) > 1 ? 's' : ''} before`
                          : `${command.draft.reminderMinutes} minutes before`
                        }
                      </p>
                    </div>
                  )}

                  {command.draft.description && (
                    <div className="flex items-start gap-2 pt-2 border-t border-gray-200">
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                        <p className="text-gray-700 text-sm whitespace-pre-line">{command.draft.description}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      setEventDraft(command.draft);
                      setUIState('preview');
                    }}
                    className="btn-primary flex-1"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setExpandedIndex(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {command.intent === 'view' && (
              <ViewEvents
                timeframe={command.timeframe}
                startISO={command.startISO || ''}
                endISO={command.endISO || ''}
              />
            )}

            {command.intent === 'delete' && (
              <div className="p-4 space-y-3">
                <div className="text-sm text-gray-600">
                  <p>Delete events matching: <strong>{command.searchQuery}</strong></p>
                </div>
                <button
                  onClick={() => handleExecuteCommand(command)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Find & Delete
                </button>
              </div>
            )}

            {command.intent === 'modify' && (
              <div className="p-4 space-y-3">
                <div className="text-sm text-gray-600">
                  <p>Modify events matching: <strong>{command.searchQuery}</strong></p>
                </div>
                <button
                  onClick={() => handleExecuteCommand(command)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
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
    <div className="space-y-3">
      <h3 className="font-semibold text-lg text-gray-900">
        Multiple Commands ({multipleCommands.length})
      </h3>

      <div className="space-y-2">
        {multipleCommands.map((command, index) => renderCommandContent(command, index))}
      </div>
    </div>
  );
}
