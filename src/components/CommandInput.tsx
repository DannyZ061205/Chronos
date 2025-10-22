import { useState, useEffect, useRef } from 'react';
import { usePopupStore } from '@/stores/popupStore';
import { parseEventCommand } from '@/utils/parser';
import { getDefaults, getTimezone } from '@/utils/storage';
import { searchEvents } from '@/utils/eventMatcher';

export function CommandInput() {
  const {
    inputText,
    setInputText,
    cursorPosition,
    setCursorPosition,
    lastParsedText,
    setLastParsedText,
    setParsedIntent,
    setEventDraft,
    setParseConfidence,
    setMatchedEvents,
    setSelectedEvent,
    setUIState,
    uiState,
    eventDraft
  } = usePopupStore();

  const [isParsing, setIsParsing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus input and restore cursor position on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Restore cursor position after focus
      if (cursorPosition > 0) {
        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }

    // Listen for auto-stopped recording messages from background
    const messageListener = (message: any) => {
      if (message.type === 'RECORDING_AUTO_STOPPED_TRANSCRIBING') {
        // Auto-stop triggered, now transcribing
        setIsRecording(false);
        setIsTranscribing(true);
      } else if (message.type === 'RECORDING_TRANSCRIPTION_READY') {
        // Auto-stop completed successfully
        setIsRecording(false);
        setIsTranscribing(false);
        setInputText(message.text);

        // Focus input after transcription
        if (inputRef.current) {
          inputRef.current.focus();
        }
      } else if (message.type === 'RECORDING_TRANSCRIPTION_ERROR') {
        // Auto-stop transcription failed
        setIsRecording(false);
        setIsTranscribing(false);

        usePopupStore.getState().showToast({
          type: 'error',
          message: message.error || 'Failed to transcribe audio',
        });
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Cleanup listener on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  // Save cursor position whenever it changes
  const handleSelectionChange = () => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart);
    }
  };

  // Manual parse function triggered by button click
  const handleParse = async () => {
    if (!inputText.trim()) {
      return;
    }

    // Skip parsing if input hasn't changed since last parse
    if (inputText === lastParsedText && eventDraft) {
      console.log('Skipping LLM parse - input unchanged since last parse');
      return;
    }

    setIsParsing(true);
    setUIState('parsing');

    try {
      // Get user defaults
      const defaults = await getDefaults();
      const tz = getTimezone(defaults.tzOverride);

      // Parse the command
      const result = await parseEventCommand(
        inputText,
        defaults.durationMinutes,
        tz
      );

      if (result.success && result.intent) {
        setParsedIntent(result.intent);
        setParseConfidence(result.intent.confidence || 0);

        // Save the text that was just parsed to avoid re-parsing on reopen
        setLastParsedText(inputText);

        // Handle different intents
        if (result.intent.intent === 'create') {
          // Add original input to draft for context-aware time inference
          const draftWithContext = {
            ...result.intent.draft,
            originalInput: inputText,
          };
          setEventDraft(draftWithContext);
          // Check if time confirmation is needed first
          if (result.intent.draft.needsTimeConfirmation) {
            setUIState('time_confirmation');
          } else if (result.intent.draft.needsDurationConfirmation) {
            // If time is provided but duration needs confirmation
            setUIState('duration_confirmation');
          } else {
            setUIState('preview');
          }
        } else if (result.intent.intent === 'create_multiple') {
          // Handle multiple events - show first event in preview
          const drafts = result.intent.drafts;
          if (drafts.length > 0) {
            // Store all drafts in a new store field (we'll add this)
            usePopupStore.getState().setMultipleEventDrafts(drafts);
            setEventDraft(drafts[0]); // Show first one in preview
            setUIState('preview');

            // Show toast to inform user about multiple events
            usePopupStore.getState().showToast({
              type: 'info',
              message: `Found ${drafts.length} events. Review and create them one by one.`,
            });
          }
        } else if (result.intent.intent === 'delete') {
          // Fetch current events and search for matches
          try {
            const { accountStatus } = usePopupStore.getState();
            // Always search in both calendars for delete operations
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
              console.log('Delete: Fetched events from calendars:', eventsResponse.events.length);
              console.log('Delete: Events by source:', {
                google: eventsResponse.events.filter((e: any) => e.source === 'google').length,
                outlook: eventsResponse.events.filter((e: any) => e.source === 'outlook').length,
              });

              const matched = searchEvents(eventsResponse.events, result.intent.searchQuery);
              console.log('Delete: Matched events:', matched);

              setMatchedEvents(matched);
              setSelectedEvent(matched[0] || null);

              if (matched.length > 0) {
                setUIState('delete_confirm');
              } else {
                usePopupStore.getState().showToast({
                  type: 'error',
                  message: 'No matching events found',
                });
                setUIState('idle');
              }
            }
          } catch (error) {
            console.error('Error fetching events for delete:', error);
            setUIState('idle');
          }
        } else if (result.intent.intent === 'modify') {
          // Fetch current events and search for matches
          try {
            const { accountStatus } = usePopupStore.getState();
            // Always search in both calendars for modify operations
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
              const matched = searchEvents(eventsResponse.events, result.intent.searchQuery);
              setMatchedEvents(matched);
              setSelectedEvent(matched[0] || null);

              if (matched.length > 0) {
                setUIState('modify_form');
              } else {
                usePopupStore.getState().showToast({
                  type: 'error',
                  message: 'No matching events found',
                });
                setUIState('idle');
              }
            }
          } catch (error) {
            console.error('Error fetching events for modify:', error);
            setUIState('idle');
          }
        } else if (result.intent.intent === 'view') {
          // View events in a specific timeframe
          // Store the view intent data for the ViewEvents component
          usePopupStore.getState().setViewTimeframe({
            timeframe: result.intent.timeframe,
            startISO: result.intent.startISO || '',
            endISO: result.intent.endISO || '',
          });
          setUIState('view_events');
        } else if (result.intent.intent === 'multiple_commands') {
          // Handle multiple distinct commands in one input
          // Store all commands for the MultipleCommands component
          usePopupStore.getState().setMultipleCommands(result.intent.commands);
          setUIState('multiple_commands');
        }
      } else if (result.success && result.draft) {
        // Legacy support
        setEventDraft(result.draft);
        setParseConfidence(result.confidence || 0);
        setUIState('preview');
      } else {
        // Parsing failed - show error if available
        if (result.error) {
          usePopupStore.getState().showToast({
            type: 'error',
            message: result.error,
          });
        }
        setEventDraft(null);
        setUIState('idle');
      }
    } finally {
      setIsParsing(false);
    }
  };

  // Handle input text changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setInputText(newText);

    // If input is cleared, reset everything
    if (!newText.trim()) {
      setEventDraft(null);
      setUIState('idle');
      setLastParsedText('');
      setParsedIntent(null);
      setParseConfidence(0);
      usePopupStore.getState().setMultipleEventDrafts([]);
      usePopupStore.getState().setCurrentEventIndex(0);
      usePopupStore.getState().setMultipleCommands(null);
      usePopupStore.getState().setViewTimeframe(null);
    } else {
      // If user is typing and we're showing results, reset to idle so parse button shows
      if (uiState !== 'idle' && uiState !== 'parsing' && uiState !== 'editing') {
        setUIState('idle');
        setEventDraft(null);
        setParsedIntent(null);
        usePopupStore.getState().setMultipleCommands(null);
        usePopupStore.getState().setViewTimeframe(null);
      }
    }
  };

  // Support Enter key to trigger parse
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleParse();
    } else if (e.key === 'Escape') {
      setInputText('');
      setEventDraft(null);
      setUIState('idle');
      setLastParsedText('');
      setParsedIntent(null);
      setParseConfidence(0);
      usePopupStore.getState().setMultipleEventDrafts([]);
      usePopupStore.getState().setCurrentEventIndex(0);
      usePopupStore.getState().setMultipleCommands(null);
      usePopupStore.getState().setViewTimeframe(null);
    }
  };

  // Handle voice input button click
  const handleVoiceInput = async () => {
    if (isRecording) {
      // Stop recording and start transcribing
      setIsRecording(false);
      setIsTranscribing(true);

      try {
        const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });

        if (response.success && response.text) {
          // Set the transcribed text in the input
          setInputText(response.text);
          setIsTranscribing(false);

          // Focus input after transcription
          if (inputRef.current) {
            inputRef.current.focus();
          }
        } else {
          setIsTranscribing(false);
          usePopupStore.getState().showToast({
            type: 'error',
            message: response.error || 'Failed to transcribe audio',
          });
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        setIsTranscribing(false);
        usePopupStore.getState().showToast({
          type: 'error',
          message: 'Failed to stop recording',
        });
      }
    } else {
      // Start recording
      try {
        console.log('[POPUP] Starting recording...');

        const response = await chrome.runtime.sendMessage({ type: 'START_RECORDING' });

        if (response.success) {
          setIsRecording(true);
        } else {
          // Check if it's a permission error
          if (response.error && response.error.includes('Permission dismissed')) {
            // Open permission page in new tab
            chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
          } else {
            usePopupStore.getState().showToast({
              type: 'error',
              message: response.error || 'Failed to start recording',
            });
          }
        }
      } catch (error) {
        console.error('Error starting recording:', error);
        usePopupStore.getState().showToast({
          type: 'error',
          message: 'Failed to start recording.',
        });
      }
    }
  };

  const disabled = uiState === 'submitting' || isParsing || isTranscribing;

  // Hide parse button when showing results (user should clear/edit to parse again)
  const isShowingResults = uiState !== 'idle' && uiState !== 'parsing';

  // Show parse button only when: (1) there's text AND (2) not showing results
  const showParseButton = inputText.trim().length > 0 && !isShowingResults;

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelectionChange}
          onClick={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          disabled={disabled}
          placeholder={isTranscribing ? "Transcribing your voice..." : "Type an event: 'Lunch with Sara Friday 1pm for 45m'"}
          className={`input resize-none pr-12 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          rows={2}
          aria-label="Event command input"
        />
        {/* Voice input button */}
        <button
          onClick={handleVoiceInput}
          disabled={disabled}
          className={`absolute right-2 top-2 p-2 rounded-lg transition-all ${
            isTranscribing
              ? 'bg-purple-500 text-white'
              : isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              : 'bg-purple-100 hover:bg-purple-200 text-purple-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={isTranscribing ? 'Transcribing...' : isRecording ? 'Stop recording' : 'Start voice input'}
          title={isTranscribing ? 'Transcribing audio...' : isRecording ? 'Click to stop recording' : 'Click to start voice input'}
        >
          {isTranscribing ? (
            <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
      </div>

      {showParseButton && (
        <button
          onClick={handleParse}
          disabled={isParsing}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isParsing ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Parsing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Parse Event (⌘↵)
            </>
          )}
        </button>
      )}
    </div>
  );
}
