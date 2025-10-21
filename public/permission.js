// Permission request page script
const grantBtn = document.getElementById('grantBtn');
const statusDiv = document.getElementById('status');

grantBtn.addEventListener('click', async () => {
  try {
    statusDiv.textContent = 'Requesting permission...';
    statusDiv.className = '';

    // Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Permission granted! Stop the stream
    stream.getTracks().forEach(track => track.stop());

    statusDiv.textContent = '✓ Permission granted! You can now use voice recording in Chronos.';
    statusDiv.className = 'success';

    // Store permission status
    await chrome.storage.local.set({ microphonePermissionGranted: true });

    // Close this tab after 2 seconds
    setTimeout(() => {
      window.close();
    }, 2000);

  } catch (error) {
    console.error('Permission error:', error);

    if (error.name === 'NotAllowedError') {
      statusDiv.textContent = '✗ Permission denied. Please allow microphone access when prompted.';
    } else {
      statusDiv.textContent = '✗ Error: ' + error.message;
    }
    statusDiv.className = 'error';
  }
});
