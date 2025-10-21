/**
 * Whisper transcription utility using OpenAI API
 */

// API configuration - hardcoded for all users (same as llmParser)
const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';
// Key split into parts to make extraction slightly harder
const _p1 = 'sk-proj-RDTYgp2CkfEJZSyFcNBhxkDhswaPfmjdkPihs0lI1sidm6peUtdsaikF8s';
const _p2 = 'GTe6tchld3J1d9NYT3BlbkFJcDFDAfgIW_cb6q7bsno61QNvFdK6vxqQBjO5YWU';
const _p3 = 'ty92FAYi0yJZkeFRJx5IQziO2VXlesI8gkA';
const OPENAI_API_KEY = _p1 + _p2 + _p3;

/**
 * Transcribe audio using OpenAI Whisper API
 * @param audioData Base64 encoded audio data
 * @param mimeType MIME type of the audio (e.g., 'audio/webm')
 * @returns Transcribed text
 */
export async function transcribeAudio(
  audioData: string,
  mimeType: string
): Promise<{ success: true; text: string } | { success: false; error: string }> {
  try {
    console.log('[WHISPER] Starting transcription...');
    console.log('[WHISPER] Audio size:', audioData.length, 'bytes (base64)');
    console.log('[WHISPER] MIME type:', mimeType);

    // Convert base64 to blob
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: mimeType });

    console.log('[WHISPER] Blob size:', audioBlob.size, 'bytes');

    // Create FormData for multipart upload
    const formData = new FormData();

    // Determine file extension based on mime type
    let extension = 'webm';
    if (mimeType.includes('mp4')) extension = 'mp4';
    else if (mimeType.includes('mpeg')) extension = 'mp3';
    else if (mimeType.includes('wav')) extension = 'wav';

    formData.append('file', audioBlob, `recording.${extension}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // You can make this configurable
    formData.append('response_format', 'json');

    console.log('[WHISPER] Sending request to Whisper API...');

    // Make API call
    const response = await fetch(`${OPENAI_API_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    console.log('[WHISPER] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WHISPER] API error:', errorText);

      let errorMessage = `Whisper API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        // Error text wasn't JSON
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    const result = await response.json();
    console.log('[WHISPER] Transcription result:', result);

    if (!result.text) {
      return {
        success: false,
        error: 'No transcription text returned',
      };
    }

    return {
      success: true,
      text: result.text,
    };
  } catch (error) {
    console.error('[WHISPER] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
