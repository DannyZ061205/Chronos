// Offscreen document for handling audio recording with voice activity detection
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;
let silenceTimer = null;
let noVoiceTimer = null;
let hasDetectedVoice = false;

// Voice activity detection settings
const SILENCE_THRESHOLD = 0.01; // Audio level threshold (0-1)
const NO_VOICE_TIMEOUT = 3500; // 3.5 seconds - auto-stop if no voice detected
const SILENCE_AFTER_SPEECH_TIMEOUT = 2700; // 2.7 seconds - auto-stop after user finishes speaking

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
    hasDetectedVoice = false;
    clearTimeout(silenceTimer);
    clearTimeout(noVoiceTimer);

    // Set up audio analysis for voice activity detection
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 2048;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Set up MediaRecorder
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start();
    console.log('[OFFSCREEN] Recording started with voice activity detection');

    // Start monitoring audio levels
    monitorAudioLevel(dataArray);

    // Start "no voice detected" timer (3.5 seconds)
    noVoiceTimer = setTimeout(() => {
      if (!hasDetectedVoice) {
        console.log('[OFFSCREEN] No voice detected after 3.5 seconds, auto-stopping...');
        autoStopRecording();
      }
    }, NO_VOICE_TIMEOUT);

  } catch (error) {
    console.error('[OFFSCREEN] Error starting recording:', error);
    throw error;
  }
}

// Monitor audio levels for voice activity detection
function monitorAudioLevel(dataArray) {
  if (!analyser || !mediaRecorder || mediaRecorder.state !== 'recording') {
    return;
  }

  analyser.getByteTimeDomainData(dataArray);

  // Calculate audio level (RMS)
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const normalized = (dataArray[i] - 128) / 128;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / dataArray.length);

  // Check if voice is detected (above threshold)
  if (rms > SILENCE_THRESHOLD) {
    // Voice detected!
    if (!hasDetectedVoice) {
      console.log('[OFFSCREEN] Voice detected!');
      hasDetectedVoice = true;
      clearTimeout(noVoiceTimer); // Cancel the "no voice" timer
    }

    // Reset silence timer since we're hearing voice
    clearTimeout(silenceTimer);
    silenceTimer = null;
  } else if (hasDetectedVoice) {
    // Silence detected after voice was heard
    if (!silenceTimer) {
      console.log('[OFFSCREEN] Silence detected, starting 2.7s timer...');
      silenceTimer = setTimeout(() => {
        console.log('[OFFSCREEN] User finished speaking (2.7s silence), auto-stopping...');
        autoStopRecording();
      }, SILENCE_AFTER_SPEECH_TIMEOUT);
    }
  }

  // Continue monitoring
  requestAnimationFrame(() => monitorAudioLevel(dataArray));
}

// Auto-stop recording and notify background
function autoStopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    console.log('[OFFSCREEN] Auto-stopping recording...');

    // Stop recording
    stopRecording()
      .then((audioBlob) => {
        // Notify background that recording auto-stopped
        chrome.runtime.sendMessage({
          type: 'RECORDING_AUTO_STOPPED',
          audioBlob: audioBlob
        });
      })
      .catch((error) => {
        console.error('[OFFSCREEN] Error auto-stopping recording:', error);
      });
  }
}

async function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      reject(new Error('MediaRecorder not initialized'));
      return;
    }

    // Clear all timers
    clearTimeout(silenceTimer);
    clearTimeout(noVoiceTimer);
    silenceTimer = null;
    noVoiceTimer = null;

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach(track => track.stop());

      // Close audio context
      if (audioContext) {
        audioContext.close();
        audioContext = null;
        analyser = null;
      }

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
