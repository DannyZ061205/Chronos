import React from 'react';
import { useActionHistoryStore } from '@/stores/actionHistoryStore';
import { usePopupStore } from '@/stores/popupStore';

export function UndoRedoButtons() {
  const { undo, redo, canUndo, canRedo } = useActionHistoryStore();
  const { showToast } = usePopupStore();
  const [isUndoing, setIsUndoing] = React.useState(false);
  const [isRedoing, setIsRedoing] = React.useState(false);

  const handleUndo = async () => {
    if (isUndoing || isRedoing) return;

    setIsUndoing(true);
    const result = await undo();
    setIsUndoing(false);

    if (result.success) {
      const actionType = result.action?.type;
      let message = 'Action undone';

      if (actionType === 'create') {
        message = 'Event creation undone';
      } else if (actionType === 'delete') {
        message = 'Event deletion undone';
      } else if (actionType === 'modify') {
        message = 'Event modification undone';
      }

      showToast({ type: 'success', message });
    } else {
      showToast({ type: 'error', message: result.error || 'Failed to undo' });
    }
  };

  const handleRedo = async () => {
    if (isUndoing || isRedoing) return;

    setIsRedoing(true);
    const result = await redo();
    setIsRedoing(false);

    if (result.success) {
      const actionType = result.action?.type;
      let message = 'Action redone';

      if (actionType === 'create') {
        message = 'Event recreated';
      } else if (actionType === 'delete') {
        message = 'Event deleted again';
      } else if (actionType === 'modify') {
        message = 'Event modification reapplied';
      }

      showToast({ type: 'success', message });
    } else {
      showToast({ type: 'error', message: result.error || 'Failed to redo' });
    }
  };

  // Keyboard shortcuts (Cmd+Z / Ctrl+Z for undo, Cmd+Shift+Z / Ctrl+Shift+Z for redo)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo() && !isUndoing && !isRedoing) {
          handleUndo();
        }
      } else if (modifier && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (canRedo() && !isUndoing && !isRedoing) {
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, isUndoing, isRedoing]);

  return (
    <div className="flex gap-1 items-center">
      <button
        onClick={handleUndo}
        disabled={!canUndo() || isUndoing || isRedoing}
        className="p-1 hover:bg-blue-500 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        title="Undo (Cmd/Ctrl+Z)"
        aria-label="Undo last action"
      >
        {isUndoing ? (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        )}
      </button>

      <button
        onClick={handleRedo}
        disabled={!canRedo() || isUndoing || isRedoing}
        className="p-1 hover:bg-blue-500 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        title="Redo (Cmd/Ctrl+Shift+Z)"
        aria-label="Redo last undone action"
      >
        {isRedoing ? (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
          </svg>
        )}
      </button>
    </div>
  );
}
