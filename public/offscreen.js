// Offscreen document for handling audio recording (manual mode only)
let mediaRecorder = null;
let audioChunks = [];

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    startRecording()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === 'STOP_RECORDING') {
    stopRecording()
      .then((audioBlob) => {
        // Send the audio blob back to background
        sendResponse({ success: true, audioBlob });
      })
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Reset state
    audioChunks = [];

    // Set up MediaRecorder (NO voice activity detection - purely manual)
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start();
    console.log('[OFFSCREEN] Recording started (manual mode - no auto-stop)');

  } catch (error) {
    console.error('[OFFSCREEN] Error starting recording:', error);
    throw error;
  }
}

async function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      // Silently resolve if mediaRecorder doesn't exist (e.g., permission was never granted)
      console.log('[OFFSCREEN] stopRecording called but mediaRecorder is null, ignoring...');
      resolve({ data: '', mimeType: 'audio/webm', size: 0 });
      return;
    }

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach(track => track.stop());

      console.log('[OFFSCREEN] Recording stopped, blob size:', audioBlob.size);

      // Convert blob to base64 for transmission
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          data: reader.result.split(',')[1], // Get base64 part only
          mimeType: audioBlob.type,
          size: audioBlob.size
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorder.stop();
  });
}
