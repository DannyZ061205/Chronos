import { usePopupStore } from '@/stores/popupStore';
import { useActionHistoryStore } from '@/stores/actionHistoryStore';
import { generateClientRequestId, markAsCreated, saveRecentEvent } from '@/utils/storage';
import type { CreateEventRequest, CreateEventResponse, UIState } from '@/types';

export function ActionButtons() {
  const {
    eventDraft,
    targets,
    uiState,
    setUIState,
    showToast,
    reset,
    accountStatus,
    multipleEventDrafts,
    currentEventIndex,
    setCurrentEventIndex,
    setEventDraft,
  } = usePopupStore();

  const { addAction } = useActionHistoryStore();

  const hasMultipleEvents = multipleEventDrafts.length > 0;
  const isLastEvent = hasMultipleEvents && currentEventIndex === multipleEventDrafts.length - 1;
  
  const canSubmit = 
    eventDraft && 
    (uiState === 'preview' || uiState === 'success' || uiState === 'partial') &&
    (targets.google || targets.outlook) &&
    (accountStatus.google || accountStatus.outlook);
  
  const handleConfirm = async () => {
    if (!eventDraft) return;
    
    setUIState('submitting');
    
    try {
      // Generate client request ID for idempotency
      const clientRequestId = await generateClientRequestId(
        eventDraft.title,
        eventDraft.startISO,
        eventDraft.endISO,
        eventDraft.tz
      );

      console.log('ActionButtons - eventDraft:', eventDraft);
      console.log('ActionButtons - description:', eventDraft.description);

      // Send message to service worker
      const request: CreateEventRequest = {
        type: 'CREATE_EVENT',
        payload: {
          title: eventDraft.title,
          startISO: eventDraft.startISO,
          endISO: eventDraft.endISO,
          tz: eventDraft.tz,
          description: eventDraft.description,
          recurrence: eventDraft.recurrence,
          targets: {
            google: targets.google && accountStatus.google,
            outlook: targets.outlook && accountStatus.outlook,
          },
          clientRequestId,
        },
      };

      console.log('ActionButtons - Sending request:', request);

      const response = await chrome.runtime.sendMessage(request) as CreateEventResponse;
      
      // Mark as created
      await markAsCreated(clientRequestId);

      // Save to recent events history
      await saveRecentEvent({
        title: eventDraft.title,
        startISO: eventDraft.startISO,
        endISO: eventDraft.endISO,
        tz: eventDraft.tz,
        description: eventDraft.description,
      });

      // Handle response
      const googleOk = response.results.google?.ok ?? false;
      const outlookOk = response.results.outlook?.ok ?? false;

      // Track successful creations for undo
      const createdEvents = [];
      if (googleOk && response.results.google?.eventId) {
        createdEvents.push({
          eventId: response.results.google.eventId,
          source: 'google' as const,
          event: {
            id: response.results.google.eventId,
            title: eventDraft.title,
            startISO: eventDraft.startISO,
            endISO: eventDraft.endISO,
            description: eventDraft.description,
            location: '',
            recurrence: eventDraft.recurrence,
            source: 'google' as const,
          },
        });
      }
      if (outlookOk && response.results.outlook?.eventId) {
        createdEvents.push({
          eventId: response.results.outlook.eventId,
          source: 'outlook' as const,
          event: {
            id: response.results.outlook.eventId,
            title: eventDraft.title,
            startISO: eventDraft.startISO,
            endISO: eventDraft.endISO,
            description: eventDraft.description,
            location: '',
            recurrence: eventDraft.recurrence,
            source: 'outlook' as const,
          },
        });
      }

      // Add to action history if any events were created
      if (createdEvents.length > 0) {
        addAction({
          type: 'create',
          createdEvent: createdEvents,
        });
      }

      if (googleOk && outlookOk) {
        // Full success
        if (hasMultipleEvents && !isLastEvent) {
          // Move to next event
          const nextIndex = currentEventIndex + 1;
          setCurrentEventIndex(nextIndex);
          setEventDraft(multipleEventDrafts[nextIndex]);
          setUIState('preview');

          showToast({
            type: 'success',
            message: `✓ Event ${currentEventIndex + 1}/${multipleEventDrafts.length} created! Review next event.`,
          });
        } else {
          // Last event or single event - show success and reset
          showToast({
            type: 'success',
            message: hasMultipleEvents
              ? `✓ All ${multipleEventDrafts.length} events created successfully!`
              : '✓ Event added to both calendars!',
          });
          setUIState('success');

          // Reset after a short delay
          setTimeout(() => {
            reset();
          }, 2000);
        }
      } else if (googleOk || outlookOk) {
        // Partial success
        const successCal = googleOk ? 'Google' : 'Outlook';
        const failCal = googleOk ? 'Outlook' : 'Google';
        const errorMsg = googleOk 
          ? response.results.outlook?.msg 
          : response.results.google?.msg;
        
        showToast({
          type: 'info',
          message: `Added to ${successCal}. ${failCal} failed: ${errorMsg}`,
          action: {
            label: 'Retry',
            onClick: () => handleConfirm(),
          },
        });
        setUIState('partial');
      } else {
        // Full failure
        const errors = [
          response.results.google?.msg,
          response.results.outlook?.msg,
        ].filter(Boolean).join(', ');
        
        showToast({
          type: 'error',
          message: `Failed to create event: ${errors}`,
          action: {
            label: 'Retry',
            onClick: () => handleConfirm(),
          },
        });
        setUIState('error');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      showToast({
        type: 'error',
        message: 'Failed to create event. Please try again.',
      });
      setUIState('error');
    }
  };
  
  const handleCancel = () => {
    reset();
  };

  if (uiState !== 'preview' && uiState !== 'submitting' && uiState !== 'success' && uiState !== 'partial') {
    return null;
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleConfirm}
        disabled={!canSubmit || uiState === 'submitting' as UIState}
        className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uiState === 'submitting' ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            Creating...
          </span>
        ) : (
          'Confirm'
        )}
      </button>

      <button
        onClick={handleCancel}
        disabled={uiState === 'submitting'}
        className="btn-secondary disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
