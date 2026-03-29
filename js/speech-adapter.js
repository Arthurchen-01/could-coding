/**
 * speech-adapter.js — Unified Speech Recognition Adapter
 * 
 * Supports two backends:
 * 1. Web Speech API (browser-native, no API key needed)
 * 2. Provider ASR (Whisper API via configured endpoint)
 * 
 * Usage:
 *   const adapter = new SpeechAdapter({ lang: 'en-US', continuous: false });
 *   adapter.start((text) => { input.value = text; });
 *   adapter.stop();
 */

class SpeechAdapter {
  constructor(options = {}) {
    this.lang = options.lang || 'en-US';
    this.continuous = options.continuous || false;
    this.interimResults = options.interimResults !== false;
    this.onResult = options.onResult || (() => {});
    this.onError = options.onError || (() => {});
    this.onEnd = options.onEnd || (() => {});

    this.recognition = null;
    this.isListening = false;
    this._initWebSpeech();
  }

  // ── Layer 1: Web Speech API (browser-native) ──
  _initWebSpeech() {
    const win = window;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.lang;
    this.recognition.continuous = this.continuous;
    this.recognition.interimResults = this.interimResults;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const isFinal = event.results[event.results.length - 1].isFinal;
      this.onResult(transcript, isFinal);
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      this.onError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onEnd();
    };
  }

  get supported() {
    return !!this.recognition;
  }

  start() {
    if (!this.supported) {
      this.onError('not-supported');
      return;
    }
    try {
      this.recognition.start();
    } catch (e) {
      // Already started - restart
      this.recognition.stop();
      setTimeout(() => this.recognition.start(), 100);
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  // ── Layer 2: Provider ASR (Whisper API) ──
  /**
   * Transcribe audio blob via Provider ASR
   * @param {Blob} audioBlob - Audio data from MediaRecorder
   * @param {Object} config - API config from api-config
   * @returns {Promise<string>} transcript
   */
  static async transcribeViaProvider(audioBlob, config = {}) {
    const apiConfig = config.apiKey
      ? config
      : SpeechAdapter._loadApiConfig();

    if (!apiConfig.apiKey || !apiConfig.baseUrl) {
      throw new Error('ASR not configured. Please set up API key in Settings.');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', apiConfig.sttModelId || 'whisper-1');
    formData.append('language', SpeechAdapter._langCode(apiConfig.lang || 'en'));

    const response = await fetch(`${apiConfig.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiConfig.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(err.error?.message || 'ASR request failed');
    }

    const data = await response.json();
    return data.text || '';
  }

  // ── Layer 2: MediaRecorder capture (for provider ASR) ──
  /**
   * Start recording via MediaRecorder and prepare for provider ASR
   * @param {Function} onDataAvailable - called with chunks of audio data
   * @returns {Object} { stop, getBlob }
   */
  static async startMediaRecorder(onDataAvailable) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
        onDataAvailable(e.data);
      }
    };

    recorder.start(100); // collect data every 100ms
    return {
      stop: () => {
        return new Promise((resolve) => {
          recorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(chunks, { type: 'audio/webm' });
            resolve(blob);
          };
          recorder.stop();
        });
      },
    };
  }

  // ── Helpers ──
  static _loadApiConfig() {
    try {
      return JSON.parse(localStorage.getItem('api-config') || '{}');
    } catch {
      return {};
    }
  }

  static _langCode(lang) {
    const map = {
      'en-US': 'en', 'en-GB': 'en',
      'zh-CN': 'zh', 'zh': 'zh',
      'ja': 'ja', 'ko': 'ko',
    };
    return map[lang] || 'en';
  }
}

// ── Auto-detect best ASR backend ──
/**
 * Simple voice capture helper:
 * 1. Try Web Speech API first (free, no API key)
 * 2. Fall back to Provider ASR if configured
 * 
 * @param {Object} options
 * @param {Function} options.onResult - (text: string, isFinal: boolean) => void
 * @param {Function} options.onError - (error: string) => void
 * @param {boolean} options.useProvider - force provider ASR (default: auto)
 */
function captureVoice(options = {}) {
  const { onResult = () => {}, onError = () => {}, useProvider = false } = options;

  // Try Web Speech API first
  if (!useProvider && SpeechAdapter.prototype.supported) {
    const adapter = new SpeechAdapter({
      lang: 'en-US',
      onResult,
      onError,
    });
    adapter.start();
    return { stop: () => adapter.stop(), type: 'webspeech' };
  }

  // Fall back to Provider ASR via MediaRecorder
  let mr;
  const chunks = [];

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr = recorder;
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.start(100);

      // After 30 seconds max, auto-stop
      const timeout = setTimeout(() => recorder.stop(), 30000);
      recorder.onstop = async () => {
        clearTimeout(timeout);
        stream.getTracks().forEach(t => t.stop());
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const text = await SpeechAdapter.transcribeViaProvider(blob);
          onResult(text, true);
        } catch (err) {
          onError(err.message);
        }
      };
    })
    .catch(err => onError(err.message));

  return {
    stop: () => { if (mr && mr.state === 'recording') mr.stop(); },
    type: 'provider',
  };
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SpeechAdapter, captureVoice };
}
